package com.example.connectportal

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.AlarmManager
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

    // Keep track of active notifications
    private val displayedNotifs = mutableSetOf<String>()
    private var activeCallNotifId: String? = null
    private var activeCallSystemId: Int? = null

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
                        
                        val currentIds = mutableSetOf<String>()
                        var hasCallNotif = false

                        for (i in 0 until notifs.length()) {
                            val notif = notifs.getJSONObject(i)
                            val id = notif.getString("_id")
                            val type = notif.optString("type", "system")
                            val title = notif.getString("title")
                            val message = notif.getString("message")
                            val isRead = notif.getBoolean("isRead")

                            if (!isRead) {
                                currentIds.add(id)
                                
                                if (type == "call") {
                                    hasCallNotif = true
                                }

                                // Show notification if not already displayed
                                if (!displayedNotifs.contains(id)) {
                                    displayedNotifs.add(id)
                                    
                                    if (type == "call") {
                                        activeCallNotifId = id
                                        activeCallSystemId = System.currentTimeMillis().toInt()
                                        showCallNotification(activeCallSystemId!!, title, message)
                                    } else {
                                        showNewNotification(id.hashCode(), title, message)
                                    }
                                }
                            }
                        }

                        // Clean up displayedNotifs that are no longer in the active list (e.g. read or deleted)
                        displayedNotifs.retainAll(currentIds)

                        // If call was active but is no longer in the list, cancel its notification
                        if (activeCallNotifId != null && !hasCallNotif) {
                            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                            activeCallSystemId?.let { notificationManager.cancel(it) }
                            activeCallNotifId = null
                            activeCallSystemId = null
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                // Poll every 3 seconds for low-latency notifications
                delay(3000)
            }
        }
    }

    private fun showNewNotification(notificationId: Int, title: String, message: String) {
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

        notificationManager.notify(notificationId, notification)
    }

    private fun showCallNotification(notificationId: Int, title: String, message: String) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "dotcore_call_notifications"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Dotcore Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Incoming call alerts from Dotcore"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 500, 1000)
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
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setContentIntent(pendingIntent)
            .setOngoing(true) // keeps the notification visible and non-dismissible
            .setAutoCancel(true)
            .build()

        notificationManager.notify(notificationId, notification)
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        val sharedPref = getSharedPreferences("DotcorePrefs", Context.MODE_PRIVATE)
        val token = sharedPref.getString("auth_token", null)
        
        // Only resurrect the service if the user remains logged in
        if (token != null) {
            val restartServiceIntent = Intent(applicationContext, this.javaClass).apply {
                setPackage(packageName)
            }
            val restartServicePendingIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                PendingIntent.getForegroundService(
                    applicationContext,
                    1,
                    restartServiceIntent,
                    PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                )
            } else {
                PendingIntent.getService(
                    applicationContext,
                    1,
                    restartServiceIntent,
                    PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
                )
            }
            val alarmService = applicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            alarmService.set(
                AlarmManager.RTC,
                System.currentTimeMillis() + 1000,
                restartServicePendingIntent
            )
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        pollJob?.cancel()
        serviceJob.cancel()
        super.onDestroy()
    }
}
