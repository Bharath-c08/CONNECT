package com.example.connectportal

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.HttpURLConnection
import java.net.URL

class CallActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        val notificationId = intent.getIntExtra("notificationId", -1)
        val notifId = intent.getStringExtra("notifId")

        // Dismiss the call notification immediately
        if (notificationId != -1) {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(notificationId)
        }

        if (action == "DECLINE_CALL") {
            // Perform decline API call on background IO thread
            CoroutineScope(Dispatchers.IO).launch {
                val sharedPref = context.getSharedPreferences("DotcorePrefs", Context.MODE_PRIVATE)
                val token = sharedPref.getString("auth_token", null) ?: return@launch

                try {
                    val url = URL("https://dotcore.onrender.com/api/notifications/reject-call")
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.setRequestProperty("Authorization", "Bearer $token")
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.connectTimeout = 8000
                    conn.readTimeout = 8000
                    
                    // Trigger the request
                    val code = conn.responseCode
                    if (code == 200) {
                        // Success: Call declined on server
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }
}
