package it.coopavola.mobile;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {
    private static final String TRUSTED_HOST = "coopavola.eggsnext.cloud";
    private String mobileAdapter;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mobileAdapter = readAsset("public/mobile-adapter.js");

        WebView webView = getBridge().getWebView();
        webView.getSettings().setUseWideViewPort(true);
        webView.getSettings().setLoadWithOverviewMode(false);
        webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (!isTrusted(url) || mobileAdapter.isEmpty()) return;
                inject(view, 250);
                inject(view, 1200);
                inject(view, 3500);
            }
        });
    }

    private void inject(WebView webView, long delayMs) {
        webView.postDelayed(() -> {
            if (isTrusted(webView.getUrl())) webView.evaluateJavascript(mobileAdapter, null);
        }, delayMs);
    }

    private boolean isTrusted(String rawUrl) {
        if (rawUrl == null) return false;
        Uri uri = Uri.parse(rawUrl);
        return "https".equalsIgnoreCase(uri.getScheme()) && TRUSTED_HOST.equalsIgnoreCase(uri.getHost());
    }

    private String readAsset(String path) {
        try (InputStream input = getAssets().open(path); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString(StandardCharsets.UTF_8.name());
        } catch (IOException error) {
            return "";
        }
    }
}
