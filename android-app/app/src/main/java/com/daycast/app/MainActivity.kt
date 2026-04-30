package com.daycast.app

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var etServerIp: EditText
    private lateinit var etPin: EditText
    private lateinit var btnConnect: Button
    private lateinit var tvStatus: TextView

    private val SCREEN_CAPTURE_REQUEST = 100

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        etServerIp = findViewById(R.id.etServerIp)
        etPin = findViewById(R.id.etPin)
        btnConnect = findViewById(R.id.btnConnect)
        tvStatus = findViewById(R.id.tvStatus)

        // Handle QR Code deep link
        handleDeepLink(intent)

        btnConnect.setOnClickListener {
            val ip = etServerIp.text.toString().trim()
            val pin = etPin.text.toString().trim()

            if (ip.isEmpty()) {
                Toast.makeText(this, "Enter server IP address", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (pin.length != 6) {
                Toast.makeText(this, "Enter 6-digit PIN", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Show confirmation dialog before casting
            AlertDialog.Builder(this)
                .setTitle("🔐 Start Screen Cast?")
                .setMessage("Your screen will be mirrored to the connected browser.\n\nAre you sure you want to proceed?")
                .setPositiveButton("✅ Allow") { _, _ ->
                    ScreenCaptureService.serverIp = ip
                    ScreenCaptureService.pin = pin
                    requestScreenCapture()
                }
                .setNegativeButton("❌ Cancel", null)
                .show()
        }
    }

    // Handle deep link when app is already open
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val uri: Uri? = intent?.data
        if (uri != null && uri.scheme == "daycast" && uri.host == "connect") {
            val ip = uri.getQueryParameter("ip") ?: ""
            val pin = uri.getQueryParameter("pin") ?: ""
            val port = uri.getQueryParameter("port") ?: "3000"

            if (ip.isNotEmpty() && pin.isNotEmpty()) {
                etServerIp.setText(ip)
                etPin.setText(pin)
                tvStatus.text = "🔗 QR Code scanned! Tap Start Casting"

                ScreenCaptureService.serverIp = ip
                ScreenCaptureService.pin = pin

                // Auto show confirmation dialog after QR scan
                AlertDialog.Builder(this)
                    .setTitle("✅ QR Code Scanned!")
                    .setMessage("Server: $ip\nPIN: $pin\n\nStart casting your screen now?")
                    .setPositiveButton("🚀 Start Casting") { _, _ ->
                        requestScreenCapture()
                    }
                    .setNegativeButton("Later", null)
                    .show()
            }
        }
    }

    private fun requestScreenCapture() {
        val projectionManager = getSystemService(MEDIA_PROJECTION_SERVICE)
                as MediaProjectionManager
        startActivityForResult(
            projectionManager.createScreenCaptureIntent(),
            SCREEN_CAPTURE_REQUEST
        )
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == SCREEN_CAPTURE_REQUEST && resultCode == Activity.RESULT_OK) {
            tvStatus.text = "✅ Casting started!"

            val serviceIntent = Intent(this, ScreenCaptureService::class.java).apply {
                putExtra(ScreenCaptureService.EXTRA_RESULT_CODE, resultCode)
                putExtra(ScreenCaptureService.EXTRA_DATA, data)
                putExtra(ScreenCaptureService.EXTRA_SERVER_IP, ScreenCaptureService.serverIp)
                putExtra(ScreenCaptureService.EXTRA_PIN, ScreenCaptureService.pin)
            }
            startForegroundService(serviceIntent)

        } else {
            tvStatus.text = "❌ Permission denied"
        }
    }
}