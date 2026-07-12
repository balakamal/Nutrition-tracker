package com.personal.nutritiontracker

import android.content.Intent
import android.net.Uri
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.temporal.ChronoUnit

@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val PERMISSIONS = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class)
    )

    private fun getClient(): HealthConnectClient? {
        return try {
            val status = HealthConnectClient.getSdkStatus(context)
            if (status == HealthConnectClient.SDK_AVAILABLE) {
                HealthConnectClient.getOrCreate(context)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    @PluginMethod
    fun checkAvailability(call: PluginCall) {
        try {
            val status = HealthConnectClient.getSdkStatus(context)
            val availability = when (status) {
                HealthConnectClient.SDK_AVAILABLE -> "Available"
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "NotInstalled"
                else -> "NotSupported"
            }
            val res = JSObject()
            res.put("availability", availability)
            call.resolve(res)
        } catch (e: Exception) {
            val res = JSObject()
            res.put("availability", "NotSupported")
            call.resolve(res)
        }
    }

    @PluginMethod
    fun requestPermission(call: PluginCall) {
        val client = getClient()
        if (client == null) {
            call.reject("Health Connect not available on this device")
            return
        }
        activity.lifecycleScope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                if (granted.containsAll(PERMISSIONS)) {
                    val res = JSObject()
                    res.put("granted", true)
                    call.resolve(res)
                } else {
                    // Launch permission request — user must grant in Health Connect UI
                    val requestPermissions =
                        PermissionController.createRequestPermissionResultContract()
                    val intent = requestPermissions.createIntent(activity, PERMISSIONS)
                    activity.startActivity(intent)
                    // Resolve with pending state; user must reopen app after granting
                    val res = JSObject()
                    res.put("granted", false)
                    res.put("pending", true)
                    call.resolve(res)
                }
            } catch (e: Exception) {
                call.reject("Failed to check permissions: ${e.message}")
            }
        }
    }

    @PluginMethod
    fun getSteps(call: PluginCall) {
        val client = getClient()
        if (client == null) {
            val res = JSObject()
            res.put("steps", 0)
            res.put("available", false)
            call.resolve(res)
            return
        }
        activity.lifecycleScope.launch {
            try {
                val now = Instant.now()
                val startOfDay = now.truncatedTo(ChronoUnit.DAYS)
                val request = ReadRecordsRequest(
                    recordType = StepsRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startOfDay, now)
                )
                val response = client.readRecords(request)
                val totalSteps = response.records.sumOf { it.count }
                val res = JSObject()
                res.put("steps", totalSteps)
                res.put("available", true)
                call.resolve(res)
            } catch (e: Exception) {
                val res = JSObject()
                res.put("steps", 0)
                res.put("available", false)
                res.put("error", e.message ?: "Unknown error")
                call.resolve(res)
            }
        }
    }

    @PluginMethod
    fun openHealthConnect(call: PluginCall) {
        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                data = Uri.parse("market://details?id=com.google.android.apps.healthdata")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (intent.resolveActivity(activity.packageManager) != null) {
                activity.startActivity(intent)
            } else {
                val webIntent = Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata")
                )
                activity.startActivity(webIntent)
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to open Health Connect: ${e.message}")
        }
    }
}
