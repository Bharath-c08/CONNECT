package com.example.connectportal

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL

class NotificationWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val sharedPref = applicationContext.getSharedPreferences("DotcorePrefs", Context.MODE_PRIVATE)
        val token = sharedPref.getString("auth_token", null) ?: return Result.success()

        try {
            // Fetch notifications from the backend
            val url = URL("https://dotcore.onrender.com/api/notifications/my")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.connectTimeout = 10000
            conn.readTimeout = 10000

            if (conn.responseCode == 200) {
                val jsonText = conn.inputStream.bufferedReader().use { it.readText() }
                val notifs = JSONArray(jsonText)
                
                if (notifs.length() > 0) {
                    val latestNotif = notifs.getJSONObject(0)
                    val notifId = latestNotif.getString("_id")
                    val title = latestNotif.getString("title")
                    val message = latestNotif.getString("message")
                    val isRead = latestNotif.getBoolean("isRead")

                    val lastSeenId = sharedPref.getString("last_seen_notification_id", null)
                    
                    if (notifId != lastSeenId && !isRead) {
                        // Save last seen ID
                        sharedPref.edit().putString("last_seen_notification_id", notifId).apply()
                        
                        // Show native notification
                        showNotification(title, message)
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        return Result.success()
    }

    private fun showNotification(title: String, message: String) {
        val notificationManager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "dotcore_notifications"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Dotcore Notifications", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Updates and notifications from Dotcore portal"
            }
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(applicationContext, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            applicationContext, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(applicationContext, channelId)
            .setSmallIcon(R.mipmap.ic_launcher) // Custom app launcher icon
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }
}
