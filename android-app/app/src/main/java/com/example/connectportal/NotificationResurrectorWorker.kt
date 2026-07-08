package com.example.connectportal

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.Worker
import androidx.work.WorkerParameters

class NotificationResurrectorWorker(context: Context, workerParams: WorkerParameters) : Worker(context, workerParams) {
    override fun doWork(): Result {
        val sharedPref = applicationContext.getSharedPreferences("DotcorePrefs", Context.MODE_PRIVATE)
        val token = sharedPref.getString("auth_token", null)
        
        if (token != null) {
            val serviceIntent = Intent(applicationContext, NotificationService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                applicationContext.startForegroundService(serviceIntent)
            } else {
                applicationContext.startService(serviceIntent)
            }
        }
        return Result.success()
    }
}
