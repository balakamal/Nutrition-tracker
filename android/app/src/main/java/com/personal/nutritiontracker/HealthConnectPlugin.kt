package com.personal.nutritiontracker

import android.content.Intent
import android.net.Uri
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.temporal.ChronoUnit
import androidx.activity.result.ActivityResult

@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val PERMISSIONS = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class)
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
                    val requestPermissions =
                        PermissionController.createRequestPermissionResultContract()
                    val intent = requestPermissions.createIntent(activity, PERMISSIONS)
                    startActivityForResult(call, intent, "handlePermissionResult")
                }
            } catch (e: Exception) {
                call.reject("Failed to check permissions: ${e.message}")
            }
        }
    }

    @ActivityCallback
    private fun handlePermissionResult(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val client = getClient()
        if (client == null) {
            call.reject("Health Connect not available")
            return
        }
        activity.lifecycleScope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions()
                val isGranted = granted.containsAll(PERMISSIONS)
                val res = JSObject()
                res.put("granted", isGranted)
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Failed to verify permissions: ${e.message}")
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

    private fun mapExerciseType(type: Int): String {
        return try {
            when (type) {
                ExerciseSessionRecord.EXERCISE_TYPE_RUNNING -> "Running"
                ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "Walking"
                ExerciseSessionRecord.EXERCISE_TYPE_BIKING -> "Cycling"
                ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING -> "Swimming"
                ExerciseSessionRecord.EXERCISE_TYPE_YOGA -> "Yoga"
                ExerciseSessionRecord.EXERCISE_TYPE_PILATES -> "Pilates"
                ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING -> "Strength Training"
                ExerciseSessionRecord.EXERCISE_TYPE_HIIT -> "HIIT"
                else -> "Workout"
            }
        } catch (e: Exception) {
            "Workout"
        }
    }

    @PluginMethod
    fun readRecords(call: PluginCall) {
        val client = getClient()
        if (client == null) {
            val res = JSObject()
            res.put("records", JSArray())
            call.resolve(res)
            return
        }
        val type = call.getString("type") ?: ""
        val startTimeStr = call.getString("startTime") ?: ""
        val endTimeStr = call.getString("endTime") ?: ""

        if (startTimeStr.isEmpty() || endTimeStr.isEmpty()) {
            call.reject("startTime and endTime are required")
            return
        }

        activity.lifecycleScope.launch {
            try {
                val start = Instant.parse(startTimeStr)
                val end = Instant.parse(endTimeStr)
                val timeRangeFilter = TimeRangeFilter.between(start, end)
                
                val recordsArray = JSArray()

                when (type) {
                    "steps" -> {
                        val request = ReadRecordsRequest(
                            recordType = StepsRecord::class,
                            timeRangeFilter = timeRangeFilter
                        )
                        val response = client.readRecords(request)
                        for (record in response.records) {
                            val obj = JSObject()
                            obj.put("count", record.count)
                            obj.put("startTime", record.startTime.toString())
                            obj.put("endTime", record.endTime.toString())
                            recordsArray.put(obj)
                        }
                    }
                    "sleep" -> {
                        val request = ReadRecordsRequest(
                            recordType = SleepSessionRecord::class,
                            timeRangeFilter = timeRangeFilter
                        )
                        val response = client.readRecords(request)
                        for (record in response.records) {
                            val obj = JSObject()
                            obj.put("startTime", record.startTime.toString())
                            obj.put("endTime", record.endTime.toString())
                            val duration = java.time.Duration.between(record.startTime, record.endTime)
                            obj.put("durationMinutes", duration.toMinutes())
                            obj.put("stage", record.notes ?: "Sleep Session")
                            recordsArray.put(obj)
                        }
                    }
                    "exercise" -> {
                        val request = ReadRecordsRequest(
                            recordType = ExerciseSessionRecord::class,
                            timeRangeFilter = timeRangeFilter
                        )
                        val response = client.readRecords(request)
                        for (record in response.records) {
                            val obj = JSObject()
                            obj.put("startTime", record.startTime.toString())
                            obj.put("endTime", record.endTime.toString())
                            val duration = java.time.Duration.between(record.startTime, record.endTime)
                            obj.put("durationMinutes", duration.toMinutes())
                            obj.put("title", record.title ?: "Workout Activity")
                            obj.put("caloriesBurned", 240) // Standard default estimation for UI display
                            val typeStr = mapExerciseType(record.exerciseType)
                            obj.put("type", typeStr)
                            recordsArray.put(obj)
                        }
                    }
                }

                val res = JSObject()
                res.put("records", recordsArray)
                call.resolve(res)
            } catch (e: Exception) {
                call.reject("Failed to read records: ${e.message}")
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
