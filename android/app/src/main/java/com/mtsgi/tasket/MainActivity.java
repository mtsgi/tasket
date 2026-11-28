package com.mtsgi.tasket;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

/**
 * TasketのAndroidメインアクティビティ。
 * HealthConnectPlugin・MealAiPluginの登録およびEdge-to-Edge表示を有効化する。
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(HealthConnectPlugin.class);
        registerPlugin(MealAiPlugin.class);
        super.onCreate(savedInstanceState);

        // NoActionBarテーマ適用後にEdge-to-Edge表示を有効化する
        SystemBarStyle lightBar = SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT);
        EdgeToEdge.enable(this, lightBar, lightBar);
    }
}
