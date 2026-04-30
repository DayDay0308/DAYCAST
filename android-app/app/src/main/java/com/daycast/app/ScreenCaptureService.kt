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
import android.os.IBinder
import android.util.Base64
import android.util.Log
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
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
        val uri = URI("ws://$serverIp:8080")
        webSocketClient = object : WebSocketClient(uri) {
            override fun onOpen(handshake: ServerHandshake?) {
                Log.d(TAG, "✅ Connected to server")
                send("""{"type":"phone-auth","pin":"$pin"}""")
            }

            override fun onMessage(message: String?) {
                Log.d(TAG, "📨 Message: $message")
                if (message?.contains("auth-success") == true) {
                    startCapture()
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
        val metrics = resources.displayMetrics
        val width = metrics.widthPixels
        val height = metrics.heightPixels
        val density = metrics.densityDpi

        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)

        virtualDisplay = mediaProjection?.createVirtualDisplay(
            "DAYCAST",
            width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader?.surface, null, null
        )

        isStreaming = true
        streamFrames()
    }

    private fun streamFrames() {
        Thread {
            while (isStreaming) {
                try {
                    val image = imageReader?.acquireLatestImage() ?: continue
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
                    bitmap.compress(Bitmap.CompressFormat.JPEG, 50, stream)
                    val base64 = Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)

                    // Send frame to server
                    if (webSocketClient?.isOpen == true) {
                        webSocketClient?.send(
                            """{"type":"frame","image":"data:image/jpeg;base64,$base64"}"""
                        )
                    }

                    Thread.sleep(50) // ~20fps

                } catch (e: Exception) {
                    Log.e(TAG, "Frame error: ${e.message}")
                }
            }
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