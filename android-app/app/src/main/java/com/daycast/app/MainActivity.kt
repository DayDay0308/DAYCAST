package com.daycast.app

import android.app.Activity
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
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

            ScreenCaptureService.serverIp = ip
            ScreenCaptureService.pin = pin

            requestScreenCapture()
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