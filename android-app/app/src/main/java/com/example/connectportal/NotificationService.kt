package com.example.connectportal

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.*
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL

class NotificationService : Service() {

    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(Dispatchers.IO + serviceJob)
    private var pollJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Start as foreground service to prevent getting killed when app is closed
        startForegroundServiceNotification()
        
        // Start polling loop
        startPolling()

        return START_STICKY
    }

    private fun startForegroundServiceNotification() {
        val channelId = "dotcore_service_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Dotcore Sync Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps Dotcore portal synchronized in the background"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }

        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Dotcore Sync Active")
            .setContentText("Listening for real-time notifications...")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()

        startForeground(999, notification)
    }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = serviceScope.launch {
            val sharedPref = getSharedPreferences("DotcorePrefs", Context.MODE_PRIVATE)
            
            while (isActive) {
                val token = sharedPref.getString("auth_token", null)
                if (token == null) {
                    stopSelf()
                    break
                }

                try {
                    val url = URL("https://dotcore.onrender.com/api/notifications/my")
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "GET"
                    conn.setRequestProperty("Authorization", "Bearer $token")
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.connectTimeout = 8000
                    conn.readTimeout = 8000

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
                                sharedPref.edit().putString("last_seen_notification_id", notifId).apply()
                                showNewNotification(title, message)
                            }
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                // Poll every 10 seconds
                delay(10000)
            }
        }
    }

    private fun showNewNotification(title: String, message: String) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "dotcore_notifications"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Dotcore Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Updates and notifications from Dotcore portal"
            }
            notificationManager.createNotificationChannel(channel)
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
    }

    override fun onDestroy() {
        pollJob?.cancel()
        serviceJob.cancel()
        super.onDestroy()
    }
}
