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
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.JavascriptInterface
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts

class MainActivity : ComponentActivity() {
  private var webView: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    // Start background notification service if already logged in
    val sharedPref = getSharedPreferences("DotcorePrefs", Context.MODE_PRIVATE)
    if (sharedPref.getString("auth_token", null) != null) {
      val serviceIntent = Intent(this, NotificationService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        startForegroundService(serviceIntent)
      } else {
        startService(serviceIntent)
      }
    }

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

    // Start background notification service immediately on login
    val serviceIntent = Intent(context, NotificationService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(serviceIntent)
    } else {
      context.startService(serviceIntent)
    }
  }

  @JavascriptInterface
  fun clearAuthToken() {
    val sharedPref = context.getSharedPreferences("DotcorePrefs", Context.MODE_PRIVATE)
    with(sharedPref.edit()) {
      remove("auth_token")
      apply()
    }
    // Stop background notification service on logout
    val serviceIntent = Intent(context, NotificationService::class.java)
    context.stopService(serviceIntent)
  }
}
