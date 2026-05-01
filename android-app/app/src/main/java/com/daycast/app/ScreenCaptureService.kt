package com.daycast.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Base64
import android.util.Log
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.URI

class ScreenCaptureService : Service() {

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var webSocketClient: WebSocketClient? = null
    private var isStreaming = false

    companion object {
        const val TAG = "DAYCAST"
        const val CHANNEL_ID = "DaycastChannel"
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_DATA = "data"
        const val EXTRA_SERVER_IP = "server_ip"
        const val EXTRA_PIN = "pin"
        var serverIp: String = ""
        var pin: String = ""
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(1, buildNotification())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, -1) ?: -1
        val data = intent?.getParcelableExtra<Intent>(EXTRA_DATA)
        serverIp = intent?.getStringExtra(EXTRA_SERVER_IP) ?: ""
        pin = intent?.getStringExtra(EXTRA_PIN) ?: ""

        val projectionManager = getSystemService(MEDIA_PROJECTION_SERVICE)
                as MediaProjectionManager
        mediaProjection = projectionManager.getMediaProjection(resultCode, data!!)

        connectToServer()
        return START_STICKY
    }

    private fun connectToServer() {
        val uri = if (serverIp.contains("railway.app") || serverIp.contains("https")) {
            URI("wss://${serverIp.replace("https://", "")}")
        } else {
            URI("ws://$serverIp:3000")
        }
        webSocketClient = object : WebSocketClient(uri) {
            override fun onOpen(handshake: ServerHandshake?) {
                Log.d(TAG, "✅ Connected to server")
                send("""{"type":"phone-auth","pin":"$pin"}""")
            }

            override fun onMessage(message: String?) {
                Log.d(TAG, "📨 Message: $message")

                // Auth success — start capturing
                if (message?.contains("auth-success") == true) {
                    Handler(Looper.getMainLooper()).post {
                        startCapture()
                    }
                }

                // Handle control commands from browser
                if (message?.contains("control") == true) {
                    try {
                        val json = JSONObject(message)
                        val action = json.getString("action")
                        val xRatio = json.getDouble("x").toFloat()
                        val yRatio = json.getDouble("y").toFloat()

                        val metrics = resources.displayMetrics
                        val screenX = xRatio * metrics.widthPixels
                        val screenY = yRatio * metrics.heightPixels

                        Handler(Looper.getMainLooper()).post {
                            val service = DaycastAccessibilityService.instance
                            if (service != null) {
                                when (action) {
                                    "tap" -> {
                                        Log.d(TAG, "👆 Tap at ($screenX, $screenY)")
                                        service.performTap(screenX, screenY)
                                    }
                                    "swipe" -> {
                                        val x2Ratio = json.getDouble("x2").toFloat()
                                        val y2Ratio = json.getDouble("y2").toFloat()
                                        val screenX2 = x2Ratio * metrics.widthPixels
                                        val screenY2 = y2Ratio * metrics.heightPixels
                                        Log.d(TAG, "👆 Swipe ($screenX,$screenY) → ($screenX2,$screenY2)")
                                        service.performSwipe(screenX, screenY, screenX2, screenY2)
                                    }
                                    "longpress" -> {
                                        Log.d(TAG, "👆 Long press at ($screenX, $screenY)")
                                        service.performLongPress(screenX, screenY)
                                    }
                                }
                            } else {
                                Log.e(TAG, "❌ Accessibility service not enabled!")
                            }
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Control error: ${e.message}")
                    }
                }
            }

            override fun onClose(code: Int, reason: String?, remote: Boolean) {
                Log.d(TAG, "❌ Disconnected: $reason")
                isStreaming = false
            }

            override fun onError(ex: Exception?) {
                Log.e(TAG, "❌ Error: ${ex?.message}")
            }
        }
        webSocketClient?.connect()
    }

    private fun startCapture() {
        try {
            val metrics = resources.displayMetrics
            val width = metrics.widthPixels
            val height = metrics.heightPixels
            val density = metrics.densityDpi

            imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)

            // Register callback BEFORE createVirtualDisplay
            mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    Log.d(TAG, "⏹️ MediaProjection stopped")
                    isStreaming = false
                    stopSelf()
                }
            }, Handler(Looper.getMainLooper()))

            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "DAYCAST",
                width, height, density,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader?.surface, null, null
            )

            Log.d(TAG, "📺 Virtual display created!")
            isStreaming = true
            streamFrames()

        } catch (e: Exception) {
            Log.e(TAG, "❌ startCapture error: ${e.message}")
        }
    }

    private fun streamFrames() {
        Thread {
            Log.d(TAG, "🎥 Streaming started!")
            while (isStreaming) {
                try {
                    val image = imageReader?.acquireLatestImage()
                    if (image == null) {
                        Thread.sleep(10)
                        continue
                    }

                    val planes = image.planes
                    val buffer = planes[0].buffer
                    val pixelStride = planes[0].pixelStride
                    val rowStride = planes[0].rowStride
                    val rowPadding = rowStride - pixelStride * image.width

                    val bitmap = Bitmap.createBitmap(
                        image.width + rowPadding / pixelStride,
                        image.height,
                        Bitmap.Config.ARGB_8888
                    )
                    bitmap.copyPixelsFromBuffer(buffer)
                    image.close()

                    // Compress to JPEG
                    val stream = ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 40, stream)
                    val base64 = Base64.encodeToString(
                        stream.toByteArray(),
                        Base64.NO_WRAP
                    )

                    // Send frame to server
                    if (webSocketClient?.isOpen == true) {
                        webSocketClient?.send(
                            """{"type":"frame","image":"data:image/jpeg;base64,$base64"}"""
                        )
                    }

                    Thread.sleep(50) // ~20fps

                } catch (e: Exception) {
                    Log.e(TAG, "Frame error: ${e.message}")
                    Thread.sleep(100)
                }
            }
            Log.d(TAG, "⏹️ Streaming stopped")
        }.start()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "DAYCAST Screen Capture",
            NotificationManager.IMPORTANCE_LOW
        )
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("DAYCAST")
            .setContentText("Screen casting in progress...")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        isStreaming = false
        virtualDisplay?.release()
        mediaProjection?.stop()
        webSocketClient?.close()
        super.onDestroy()
    }
}