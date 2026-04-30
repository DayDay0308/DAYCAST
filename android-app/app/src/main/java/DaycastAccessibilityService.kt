package com.daycast.app

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.util.Log
import android.view.accessibility.AccessibilityEvent

class DaycastAccessibilityService : AccessibilityService() {

    companion object {
        const val TAG = "DAYCAST_A11Y"
        var instance: DaycastAccessibilityService? = null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d(TAG, "✅ Accessibility Service connected!")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}

    override fun onInterrupt() {}

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    // Simulate tap at coordinates
    fun performTap(x: Float, y: Float) {
        val path = Path()
        path.moveTo(x, y)

        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 100))
            .build()

        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                Log.d(TAG, "✅ Tap at ($x, $y) completed")
            }
            override fun onCancelled(gestureDescription: GestureDescription?) {
                Log.d(TAG, "❌ Tap cancelled")
            }
        }, null)
    }

    // Simulate swipe
    fun performSwipe(x1: Float, y1: Float, x2: Float, y2: Float) {
        val path = Path()
        path.moveTo(x1, y1)
        path.lineTo(x2, y2)

        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 500))
            .build()

        dispatchGesture(gesture, object : GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                Log.d(TAG, "✅ Swipe completed")
            }
            override fun onCancelled(gestureDescription: GestureDescription?) {
                Log.d(TAG, "❌ Swipe cancelled")
            }
        }, null)
    }

    // Simulate long press
    fun performLongPress(x: Float, y: Float) {
        val path = Path()
        path.moveTo(x, y)

        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 1000))
            .build()

        dispatchGesture(gesture, null, null)
    }
}