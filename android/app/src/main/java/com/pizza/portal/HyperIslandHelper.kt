package com.pizza.portal

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.graphics.Bitmap
import android.os.Bundle
import android.util.Log
import io.github.d4viddf.hyperisland_kit.HyperAction
import io.github.d4viddf.hyperisland_kit.HyperIslandNotification
import io.github.d4viddf.hyperisland_kit.HyperPicture
import io.github.d4viddf.hyperisland_kit.models.CircularProgressInfo
import io.github.d4viddf.hyperisland_kit.models.ImageTextInfoLeft
import io.github.d4viddf.hyperisland_kit.models.ImageTextInfoRight
import io.github.d4viddf.hyperisland_kit.models.PicInfo
import io.github.d4viddf.hyperisland_kit.models.ProgressTextInfo
import io.github.d4viddf.hyperisland_kit.models.TextInfo
import org.json.JSONArray

/**
 * Xiaomi HyperOS (HyperIsland / Dynamic Island / Focus Notification) 統合ヘルパー。
 * 非Xiaomi端末や非対応OSバージョンでは安全にスキップし、既存のAndroid標準 / Android 16 Live Update通知へフォールバックします。
 */
object HyperIslandHelper {
    private const val TAG = "HyperIslandHelper"
    private const val MAIN_ACTIVITY_TARGET = "com.pizza.portal.MainActivity"

    /**
     * 現在の端末がXiaomi HyperIsland (Focus Notification) に対応しているか判定する
     */
    @JvmStatic
    fun isSupported(context: Context): Boolean {
        return try {
            HyperIslandNotification.isSupported(context)
        } catch (t: Throwable) {
            Log.w(TAG, "HyperIsland support check failed: ${t.message}")
            false
        }
    }

    private fun getAppIconRes(context: Context): Int {
        var icon = context.applicationInfo.icon
        if (icon == 0) {
            icon = context.resources.getIdentifier("ic_launcher", "mipmap", context.packageName)
        }
        if (icon == 0) {
            icon = android.R.drawable.ic_dialog_info
        }
        return icon
    }

    /**
     * ① LiveProgressService 用: 車両申請ステップ・タイムライン投稿・カタログ同期のリアルタイム進捗
     */
    @JvmStatic
    fun applyLiveProgress(
        context: Context,
        notificationBuilder: Notification.Builder,
        title: String,
        text: String,
        progress: Int,
        segmentsJson: String?,
        pointsJson: String?,
        contentIntent: PendingIntent
    ) {
        if (!isSupported(context)) return

        try {
            val clampedProgress = progress.coerceIn(0, 100)
            val appIcon = getAppIconRes(context)

            // プライマリカラーの決定（セグメントJSONがあれば現在の進捗に応じた色、なければグリーン/ブルー）
            var activeColor = "#10B981"
            var totalPoints = 0
            if (!pointsJson.isNullOrEmpty()) {
                try {
                    val ptsArr = JSONArray(pointsJson)
                    totalPoints = ptsArr.length().coerceIn(0, 4)
                } catch (_: Exception) {}
            }
            if (!segmentsJson.isNullOrEmpty()) {
                try {
                    val segArr = JSONArray(segmentsJson)
                    var accWeight = 0
                    for (i in 0 until segArr.length()) {
                        val seg = segArr.getJSONObject(i)
                        val w = seg.optInt("weight", 25)
                        val c = seg.optString("color", "#10B981")
                        if (clampedProgress <= accWeight + w || i == segArr.length() - 1) {
                            if (c.startsWith("#")) activeColor = c
                            break
                        }
                        accWeight += w
                    }
                } catch (_: Exception) {}
            }

            val hiBuilder = HyperIslandNotification.Builder(context, "pizza_live_progress", title)
                .setSmallWindowTarget(MAIN_ACTIVITY_TARGET)

            // アイコン登録
            val mainPic = HyperPicture("main_icon", context, appIcon)
            hiBuilder.addPicture(mainPic)

            // アクション登録（タップでポータルを開く）
            val openAction = HyperAction(
                key = "open_portal",
                title = "開く",
                pendingIntent = contentIntent,
                actionIntentType = 1,
                bgColor = activeColor,
                titleColor = "#FFFFFF"
            )
            hiBuilder.addHiddenAction(openAction)

            // 通知シェード内: BaseInfo + (MultiProgress または ProgressBar)
            hiBuilder.setBaseInfo(
                title = title,
                content = text,
                pictureKey = "main_icon",
                actionKeys = listOf("open_portal")
            )

            if (totalPoints in 1..4 && (title.contains("車両") || title.contains("審査"))) {
                // 4ステップノード進捗 (MultiProgress: 1..points)
                val step = when {
                    clampedProgress >= 95 -> totalPoints
                    clampedProgress >= 65 -> (totalPoints - 1).coerceAtLeast(1)
                    clampedProgress >= 30 -> 2.coerceAtMost(totalPoints)
                    else -> 1
                }
                hiBuilder.setMultiProgress(
                    title = text,
                    progress = step,
                    color = activeColor,
                    points = totalPoints
                )
            } else {
                hiBuilder.setProgressBar(
                    progress = clampedProgress,
                    color = activeColor,
                    colorEnd = "#34D399"
                )
            }

            // Small Island (アイコン + 円形プログレスリング) & Big Island (左アイコン+テキスト / 右円形プログレス+%表示)
            hiBuilder.setIslandConfig(priority = 1, dismissible = true)
            hiBuilder.setSmallIslandCircularProgress(
                "main_icon",
                clampedProgress,
                activeColor,
                "#33FFFFFF",
                false
            )
            hiBuilder.setBigIslandInfo(
                ImageTextInfoLeft(
                    type = 1,
                    picInfo = PicInfo(type = 1, pic = "main_icon"),
                    textInfo = TextInfo(title = title, content = text)
                ),
                null,
                null,
                null,
                ProgressTextInfo(
                    progressInfo = CircularProgressInfo(
                        clampedProgress,
                        activeColor,
                        "#33FFFFFF",
                        false
                    ),
                    textInfo = TextInfo(
                        title = "${clampedProgress}%",
                        narrowFont = true
                    )
                )
            )

            attachToNotificationBuilder(notificationBuilder, hiBuilder)
            Log.d(TAG, "Applied HyperIsland to LiveProgress: title=$title, progress=$clampedProgress")
        } catch (t: Throwable) {
            Log.w(TAG, "Failed to apply HyperIsland to LiveProgress: ${t.message}")
        }
    }

    /**
     * ② LiveUpdateService 用: アプリOTAアップデート進捗 (0..75% ダウンロード / 75..100% 検証・インストール)
     */
    @JvmStatic
    fun applyApkUpdateProgress(
        context: Context,
        notificationBuilder: Notification.Builder,
        progress: Int,
        contentText: String,
        isIndeterminate: Boolean
    ) {
        if (!isSupported(context)) return

        try {
            val clampedProgress = if (isIndeterminate) 50 else progress.coerceIn(0, 100)
            val isInstallingPhase = !isIndeterminate && clampedProgress >= 75
            val activeColor = if (isInstallingPhase) "#FF9800" else "#00C166"
            val phaseLabel = if (isInstallingPhase) "検証中" else "${clampedProgress}%"
            val appIcon = getAppIconRes(context)

            val hiBuilder = HyperIslandNotification.Builder(context, "pizza_ota_update", "GV Portal Update")
                .setSmallWindowTarget(MAIN_ACTIVITY_TARGET)

            hiBuilder.addPicture(HyperPicture("ota_icon", context, appIcon))

            hiBuilder.setBaseInfo(
                title = "ぴっざぁポータル 更新",
                content = contentText,
                pictureKey = "ota_icon"
            )
            hiBuilder.setProgressBar(
                progress = clampedProgress,
                color = activeColor,
                colorEnd = if (isInstallingPhase) "#FBBF24" else "#34D399"
            )

            hiBuilder.setIslandConfig(priority = 2, dismissible = false)
            hiBuilder.setSmallIslandCircularProgress(
                "ota_icon",
                clampedProgress,
                activeColor,
                "#33FFFFFF",
                false
            )
            hiBuilder.setBigIslandInfo(
                ImageTextInfoLeft(
                    type = 1,
                    picInfo = PicInfo(type = 1, pic = "ota_icon"),
                    textInfo = TextInfo(title = "アプリ更新", content = contentText)
                ),
                null,
                null,
                null,
                ProgressTextInfo(
                    progressInfo = CircularProgressInfo(
                        clampedProgress,
                        activeColor,
                        "#33FFFFFF",
                        false
                    ),
                    textInfo = TextInfo(
                        title = phaseLabel,
                        narrowFont = true
                    )
                )
            )

            attachToNotificationBuilder(notificationBuilder, hiBuilder)
        } catch (t: Throwable) {
            Log.w(TAG, "Failed to apply HyperIsland to APK update progress: ${t.message}")
        }
    }

    /**
     * ② LiveUpdateService 用: アップデート完了 / テストデモ完了通知
     */
    @JvmStatic
    fun applyApkUpdateComplete(
        context: Context,
        notificationBuilder: Notification.Builder,
        title: String,
        contentText: String
    ) {
        if (!isSupported(context)) return

        try {
            val appIcon = getAppIconRes(context)
            val hiBuilder = HyperIslandNotification.Builder(context, "pizza_ota_complete", title)
                .setSmallWindowTarget(MAIN_ACTIVITY_TARGET)

            hiBuilder.addPicture(HyperPicture("ota_done_icon", context, appIcon))
            hiBuilder.setBaseInfo(
                title = title,
                content = contentText,
                pictureKey = "ota_done_icon"
            )
            hiBuilder.setIslandConfig(priority = 1, timeout = 5000, dismissible = true)
            hiBuilder.setSmallIsland("ota_done_icon")
            hiBuilder.setBigIslandInfo(
                left = ImageTextInfoLeft(
                    type = 1,
                    picInfo = PicInfo(type = 1, pic = "ota_done_icon"),
                    textInfo = TextInfo(title = title, content = contentText)
                ),
                right = ImageTextInfoRight(
                    type = 2,
                    textInfo = TextInfo(title = "完了")
                )
            )

            attachToNotificationBuilder(notificationBuilder, hiBuilder)
        } catch (t: Throwable) {
            Log.w(TAG, "Failed to apply HyperIsland to APK update complete: ${t.message}")
        }
    }

    /**
     * ③ PortalFirebaseMessagingService 用: DM受信時の ChatInfo + アバターアイランド表示
     */
    @JvmStatic
    fun applyDmNotification(
        context: Context,
        notification: Notification,
        partnerName: String,
        body: String,
        avatarBitmap: Bitmap?,
        contentIntent: PendingIntent,
        markReadIntent: PendingIntent
    ) {
        if (!isSupported(context)) return

        try {
            val appIcon = getAppIconRes(context)
            val displayBody = body.ifEmpty { "新しいメッセージが届きました" }
            val hiBuilder = HyperIslandNotification.Builder(
                context,
                "pizza_dm",
                "$partnerName: $displayBody"
            ).setSmallWindowTarget(MAIN_ACTIVITY_TARGET)

            // 送信者アバター（取得できなかった場合はアプリアイコンにフォールバック）
            val avatarPic = if (avatarBitmap != null) {
                HyperPicture("sender_avatar", avatarBitmap)
            } else {
                HyperPicture("sender_avatar", context, appIcon)
            }
            hiBuilder.addPicture(avatarPic)

            // アクション: 既読にする (Broadcast = 2) / 開く (Activity = 1)
            val markReadAction = HyperAction(
                key = "dm_mark_read",
                title = "既読にする",
                pendingIntent = markReadIntent,
                actionIntentType = 2
            )
            val openAction = HyperAction(
                key = "dm_open",
                title = "開く",
                pendingIntent = contentIntent,
                actionIntentType = 1,
                bgColor = "#3B82F6",
                titleColor = "#FFFFFF"
            )
            hiBuilder.addAction(markReadAction)
            hiBuilder.addAction(openAction)

            // 通知シェード: ChatInfo テンプレート
            hiBuilder.setChatInfo(
                title = partnerName,
                content = displayBody,
                pictureKey = "sender_avatar",
                actionKeys = listOf("dm_mark_read", "dm_open")
            )

            // Island 設定: Small Island に丸型アバター、Big Island に送信者名＋本文プレビュー
            hiBuilder.setIslandConfig(priority = 2, timeout = 6000, dismissible = true)
            hiBuilder.setSmallIsland("sender_avatar")
            hiBuilder.setBigIslandInfo(
                left = ImageTextInfoLeft(
                    type = 1,
                    picInfo = PicInfo(type = 1, pic = "sender_avatar"),
                    textInfo = TextInfo(title = partnerName, content = displayBody)
                ),
                right = ImageTextInfoRight(
                    type = 2,
                    textInfo = TextInfo(title = "DM受信")
                )
            )

            attachToNotification(notification, hiBuilder)
            Log.d(TAG, "Applied HyperIsland ChatInfo to DM notification from $partnerName")
        } catch (t: Throwable) {
            Log.w(TAG, "Failed to apply HyperIsland to DM notification: ${t.message}")
        }
    }

    /**
     * ④ BackgroundWorker 用: 車両登録申請の審査結果通知（承認・仮承認・却下）および運営向け新規申請通知
     */
    @JvmStatic
    fun applyVehicleStatusNotification(
        context: Context,
        notification: Notification,
        title: String,
        body: String,
        status: String?,
        contentIntent: PendingIntent
    ) {
        if (!isSupported(context)) return

        try {
            val appIcon = getAppIconRes(context)
            val (badgeText, badgeColor) = when (status) {
                "approved" -> "承認" to "#10B981"
                "approved_warning", "temp_approved", "temp" -> "仮承認" to "#F59E0B"
                "rejected" -> "却下" to "#EF4444"
                "admin_new" -> "新規申請" to "#3B82F6"
                else -> "通知" to "#3B82F6"
            }

            val hiBuilder = HyperIslandNotification.Builder(context, "pizza_vehicle_status", "$title ($badgeText)")
                .setSmallWindowTarget(MAIN_ACTIVITY_TARGET)

            hiBuilder.addPicture(HyperPicture("vehicle_icon", context, appIcon))

            val openAction = HyperAction(
                key = "open_vehicle_result",
                title = "確認する",
                pendingIntent = contentIntent,
                actionIntentType = 1,
                bgColor = badgeColor,
                titleColor = "#FFFFFF"
            )
            hiBuilder.addAction(openAction)

            hiBuilder.setBaseInfo(
                title = title,
                content = body,
                subContent = "ステータス: $badgeText",
                pictureKey = "vehicle_icon",
                actionKeys = listOf("open_vehicle_result"),
                colorTitle = badgeColor
            )

            hiBuilder.setIslandConfig(priority = 2, timeout = 6000, dismissible = true)
            hiBuilder.setSmallIsland("vehicle_icon")
            hiBuilder.setBigIslandInfo(
                left = ImageTextInfoLeft(
                    type = 1,
                    picInfo = PicInfo(type = 1, pic = "vehicle_icon"),
                    textInfo = TextInfo(title = title, content = body)
                ),
                right = ImageTextInfoRight(
                    type = 2,
                    textInfo = TextInfo(title = badgeText)
                )
            )

            attachToNotification(notification, hiBuilder)
            Log.d(TAG, "Applied HyperIsland to vehicle status notification: status=$status ($badgeText)")
        } catch (t: Throwable) {
            Log.w(TAG, "Failed to apply HyperIsland to vehicle status notification: ${t.message}")
        }
    }

    private fun attachToNotificationBuilder(
        notificationBuilder: Notification.Builder,
        hiBuilder: HyperIslandNotification
    ) {
        val jsonParam = hiBuilder.buildJsonParam()
        val resourceBundle = hiBuilder.buildResourceBundle()
        val extras = Bundle()
        extras.putAll(resourceBundle)
        extras.putString("miui.focus.param", jsonParam)
        notificationBuilder.addExtras(extras)
    }

    private fun attachToNotification(
        notification: Notification,
        hiBuilder: HyperIslandNotification
    ) {
        val jsonParam = hiBuilder.buildJsonParam()
        val resourceBundle = hiBuilder.buildResourceBundle()
        if (notification.extras == null) {
            notification.extras = Bundle()
        }
        notification.extras.putAll(resourceBundle)
        notification.extras.putString("miui.focus.param", jsonParam)
    }
}
