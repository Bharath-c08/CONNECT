package com.example.connectportal

import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import java.io.File
import java.io.FileOutputStream

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

    // Modern back navigation handler
    onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
      override fun handleOnBackPressed() {
        if (webView?.canGoBack() == true) {
          webView?.goBack()
        } else {
          isEnabled = false
          onBackPressedDispatcher.onBackPressed()
        }
      }
    })

    enableEdgeToEdge()
    setContent {
      PortalWebView(
        url = "https://hrm.markdotintellect.com",
        onWebViewCreated = { createdWebView ->
          webView = createdWebView
          handleCallIntent(intent)
        }
      )
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleCallIntent(intent)
  }

  private fun handleCallIntent(intent: Intent?) {
    val action = intent?.action
    val callerId = intent?.getStringExtra("callerId")
    val callType = intent?.getStringExtra("callType")
    val callerName = intent?.getStringExtra("callerName")
    val signalData = intent?.getStringExtra("signalData")

    if (callerId != null) {
      val isAccept = if (action == "ACCEPT_CALL") "true" else "false"
      val safeName = callerName?.replace("'", "\\'") ?: "Operator"
      val safeSignal = signalData?.replace("'", "\\'") ?: ""

      webView?.postDelayed({
        val jsCode = """
          window.pendingCall = {
            from: '$callerId',
            type: '$callType',
            name: '$safeName',
            signal: '$safeSignal',
            accept: $isAccept
          };
          window.dispatchEvent(new CustomEvent('external-incoming-call'));
        """.trimIndent().replace("\n", " ")
        webView?.evaluateJavascript(jsCode, null)
      }, 1000)
    }
  }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun PortalWebView(url: String, onWebViewCreated: (WebView) -> Unit) {
  val context = LocalContext.current
  var activeFilePathCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }

  // File chooser launcher for photo upload, passport cropper, and documents
  val fileChooserLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.StartActivityForResult()
  ) { result ->
    val uri = result.data?.data
    val clipData = result.data?.clipData
    val results: Array<Uri>? = when {
      uri != null -> arrayOf(uri)
      clipData != null -> Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
      else -> null
    }
    activeFilePathCallback?.onReceiveValue(results)
    activeFilePathCallback = null
  }

  // Register permission launcher for dynamic notifications, camera, microphone, and storage permissions
  val permissionLauncher = rememberLauncherForActivityResult(
    contract = ActivityResultContracts.RequestMultiplePermissions()
  ) { _ -> }

  LaunchedEffect(Unit) {
    val list = mutableListOf<String>()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
        list.add(android.Manifest.permission.POST_NOTIFICATIONS)
      }
      if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) {
        list.add(android.Manifest.permission.READ_MEDIA_IMAGES)
      }
    }
    if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      list.add(android.Manifest.permission.CAMERA)
    }
    if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      list.add(android.Manifest.permission.RECORD_AUDIO)
    }
    if (list.isNotEmpty()) {
      permissionLauncher.launch(list.toTypedArray())
    }
  }

  AndroidView(
    modifier = Modifier.fillMaxSize().statusBarsPadding(),
    factory = { ctx ->
      WebView(ctx).apply {
        var currentWebViewRef: WebView? = null
        currentWebViewRef = this

        webViewClient = object : WebViewClient() {
          override fun shouldOverrideUrlLoading(view: WebView?, request: android.webkit.WebResourceRequest?): Boolean {
            val reqUrl = request?.url?.toString() ?: return false
            if (reqUrl.startsWith("tel:")) {
              try {
                val intent = Intent(Intent.ACTION_DIAL, Uri.parse(reqUrl))
                ctx.startActivity(intent)
              } catch (e: Exception) {
                Log.e("CONNECT_Web", "Failed to open phone dialer", e)
              }
              return true
            }
            if (reqUrl.startsWith("mailto:")) {
              try {
                val intent = Intent(Intent.ACTION_SENDTO, Uri.parse(reqUrl))
                ctx.startActivity(intent)
              } catch (e: Exception) {
                Log.e("CONNECT_Web", "Failed to open mail app", e)
              }
              return true
            }
            return false
          }

          override fun onPageFinished(view: WebView?, finishedUrl: String?) {
            super.onPageFinished(view, finishedUrl)
            // Inject native bridge overrides for window.print and android interface
            view?.evaluateJavascript("""
              (function() {
                if (window.AndroidInterface && !window.__nativePrintHooked) {
                  window.__nativePrintHooked = true;
                  window.print = function() {
                    window.AndroidInterface.printDocument();
                  };
                }
              })();
            """.trimIndent(), null)
          }
        }

        webChromeClient = object : WebChromeClient() {
          override fun onPermissionRequest(request: PermissionRequest?) {
            request?.grant(request.resources)
          }

          override fun onShowFileChooser(
            wv: WebView?,
            filePathCallback: ValueCallback<Array<Uri>>?,
            fileChooserParams: FileChooserParams?
          ): Boolean {
            activeFilePathCallback?.onReceiveValue(null)
            activeFilePathCallback = filePathCallback

            val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
              type = "image/*"
              addCategory(Intent.CATEGORY_OPENABLE)
            }
            return try {
              fileChooserLauncher.launch(intent)
              true
            } catch (e: Exception) {
              Log.e("CONNECT_Web", "Failed to launch file chooser", e)
              activeFilePathCallback = null
              false
            }
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
          loadWithOverviewMode = true
          useWideViewPort = true
          mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
          userAgentString = userAgentString + " CONNECT_Android_App/" + versionName
          mediaPlaybackRequiresUserGesture = false
          allowFileAccess = true
          allowContentAccess = true
        }

        // Handle standard downloads via Android DownloadManager
        setDownloadListener { downloadUrl, userAgent, contentDisposition, mimetype, _ ->
          try {
            val fileName = URLUtil.guessFileName(downloadUrl, contentDisposition, mimetype)
            val request = DownloadManager.Request(Uri.parse(downloadUrl)).apply {
              setMimeType(mimetype)
              addRequestHeader("User-Agent", userAgent)
              val cookies = CookieManager.getInstance().getCookie(downloadUrl)
              addRequestHeader("Cookie", cookies)
              setTitle(fileName)
              setDescription("Downloading file from CONNECT portal")
              setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
              setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            }
            val dm = ctx.getSystemService(Context.DOWNLOAD_SERVICE) as? DownloadManager
            dm?.enqueue(request)
            Toast.makeText(ctx, "Download started: $fileName", Toast.LENGTH_SHORT).show()
          } catch (e: Exception) {
            Log.e("CONNECT_Download", "Failed to enqueue download", e)
            Toast.makeText(ctx, "Download error: ${e.message}", Toast.LENGTH_SHORT).show()
          }
        }

        CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
        addJavascriptInterface(AndroidInterface(ctx, this), "AndroidInterface")

        loadUrl(url)
        onWebViewCreated(this)
      }
    }
  )
}

class AndroidInterface(private val context: Context, private val webView: WebView?) {
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

  /**
   * Native Base64 file download handler (ID Cards PDF/PNG, Signed Agreements)
   */
  @JavascriptInterface
  fun downloadBase64File(base64Data: String, fileName: String, mimeType: String = "") {
    try {
      val cleanBase64 = if (base64Data.contains(",")) {
        base64Data.substringAfter(",")
      } else {
        base64Data
      }
      val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
      val effectiveMime = when {
        mimeType.isNotEmpty() -> mimeType
        fileName.endsWith(".pdf", ignoreCase = true) -> "application/pdf"
        fileName.endsWith(".png", ignoreCase = true) -> "image/png"
        fileName.endsWith(".jpg", ignoreCase = true) || fileName.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
        else -> "application/octet-stream"
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        val contentValues = ContentValues().apply {
          put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
          put(MediaStore.MediaColumns.MIME_TYPE, effectiveMime)
          put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        }
        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
        if (uri != null) {
          resolver.openOutputStream(uri)?.use { os ->
            os.write(bytes)
          }
          (context as? Activity)?.runOnUiThread {
            Toast.makeText(context, "Saved to Downloads: $fileName", Toast.LENGTH_LONG).show()
          }
        }
      } else {
        val downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        if (!downloadsDir.exists()) downloadsDir.mkdirs()
        val targetFile = File(downloadsDir, fileName)
        FileOutputStream(targetFile).use { os ->
          os.write(bytes)
        }
        (context as? Activity)?.runOnUiThread {
          Toast.makeText(context, "Saved to Downloads: $fileName", Toast.LENGTH_LONG).show()
        }
      }
    } catch (e: Exception) {
      Log.e("CONNECT_Download", "Failed to save base64 file", e)
      (context as? Activity)?.runOnUiThread {
        Toast.makeText(context, "Could not save file: ${e.message}", Toast.LENGTH_SHORT).show()
      }
    }
  }

  /**
   * Native Android PrintManager Document Spooler
   */
  @JavascriptInterface
  fun printDocument() {
    (context as? Activity)?.runOnUiThread {
      try {
        val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager
        val printAdapter = webView?.createPrintDocumentAdapter("CONNECT_Document")
        if (printManager != null && printAdapter != null) {
          val printAttributes = PrintAttributes.Builder()
            .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
            .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
            .build()
          printManager.print("CONNECT Official Credential", printAdapter, printAttributes)
        }
      } catch (e: Exception) {
        Log.e("CONNECT_Print", "Error invoking Android print service", e)
        Toast.makeText(context, "Print error: ${e.message}", Toast.LENGTH_SHORT).show()
      }
    }
  }
}
