package com.example.connectportal

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.JavascriptInterface
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.ExistingWorkPolicy
import java.util.concurrent.TimeUnit
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts

class MainActivity : ComponentActivity() {
  private var webView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Schedule background WorkManager task for notification polling (real-time loop)
    val constraints = Constraints.Builder()
      .setRequiredNetworkType(NetworkType.CONNECTED)
      .build()

    val workRequest = OneTimeWorkRequestBuilder<NotificationWorker>()
      .setConstraints(constraints)
      .build()

    WorkManager.getInstance(this).enqueueUniqueWork(
      "DotcoreNotificationWork",
      ExistingWorkPolicy.KEEP,
      workRequest
    )

    enableEdgeToEdge()
    setContent {
      PortalWebView(
        url = "https://hrm.markdotintellect.com",
        onWebViewCreated = { webView = it }
      )
    }
  }

  override fun onBackPressed() {
    if (webView?.canGoBack() == true) {
      webView?.goBack()
    } else {
      super.onBackPressed()
    }
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun PortalWebView(url: String, onWebViewCreated: (WebView) -> Unit) {
  val context = LocalContext.current

  // Register permission launcher for notification permission on Android 13+
  val permissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestPermission()
  ) { isGranted ->
    // Permission status handled
  }

  LaunchedEffect(Unit) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
        permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
      }
    }
  }

  AndroidView(
    modifier = Modifier.fillMaxSize().statusBarsPadding(),
    factory = { ctx ->
      WebView(ctx).apply {
        webViewClient = object : WebViewClient() {
          override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
            url?.let { view?.loadUrl(it) }
            return true
          }
        }
        
        webChromeClient = object : WebChromeClient() {
          override fun onPermissionRequest(request: PermissionRequest?) {
            request?.grant(request.resources)
          }
        }

        val versionName = try {
          ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName
        } catch (e: Exception) {
          "1.0"
        }

        settings.apply {
          javaScriptEnabled = true
          domStorageEnabled = true
          databaseEnabled = true
          loadWithOverviewMode = true
          useWideViewPort = true
          mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
          userAgentString = userAgentString + " CONNECT_Android_App/" + versionName
        }
        
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
        addJavascriptInterface(AndroidInterface(ctx), "AndroidInterface")
        
        loadUrl(url)
        onWebViewCreated(this)
      }
    }
  )
}

class AndroidInterface(private val context: Context) {
  @JavascriptInterface
  fun saveAuthToken(token: String) {
    val sharedPref = context.getSharedPreferences("DotcorePrefs", Context.MODE_PRIVATE)
    with(sharedPref.edit()) {
      putString("auth_token", token)
      apply()
    }

    // Immediately trigger notification polling on login
    val constraints = Constraints.Builder()
      .setRequiredNetworkType(NetworkType.CONNECTED)
      .build()
    val workRequest = OneTimeWorkRequestBuilder<NotificationWorker>()
      .setConstraints(constraints)
      .build()
    WorkManager.getInstance(context).enqueueUniqueWork(
      "DotcoreNotificationWork",
      ExistingWorkPolicy.REPLACE,
      workRequest
    )
  }

  @JavascriptInterface
  fun clearAuthToken() {
    val sharedPref = context.getSharedPreferences("DotcorePrefs", Context.MODE_PRIVATE)
    with(sharedPref.edit()) {
      remove("auth_token")
      apply()
    }
    // Cancel the notification worker loop on logout
    WorkManager.getInstance(context).cancelUniqueWork("DotcoreNotificationWork")
  }
}
