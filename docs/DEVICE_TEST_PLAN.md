# Hi Talk CRM — Multi-OEM Android Device Verification Matrix (DEVICE_TEST_PLAN.md)

## 1. OEM Test Matrix & Hardware Execution Specifications
Android OEM customizations (aggressive battery management, proprietary call dialers, delayed content provider flushes) require OEM-specific verification protocols.

| OEM / OS Flavor | Target Devices | Tested OS Versions | Call Log Write Latency | Background Survival Protocol |
| :--- | :--- | :--- | :--- | :--- |
| **Samsung OneUI** | Galaxy A-series, S21/S23 | Android 12, 13, 14 (OneUI 5/6) | 400ms – 1,200ms | Disable "Put unused apps to sleep"; enable "Allow background data". |
| **Xiaomi / Poco** | Redmi Note 11/12, Poco X5 | Android 11, 12, 13 (MIUI 14/HyperOS)| 600ms – 1,800ms | Enable "Autostart"; set Battery Saver to "No restrictions". |
| **Vivo / iQOO** | Vivo Y/V series, iQOO Neo | Android 11, 12, 13 (FuntouchOS) | 700ms – 2,000ms | Enable "High background power consumption"; allow autostart. |
| **Oppo / Realme** | Oppo Reno, Realme Narzo | Android 12, 13, 14 (ColorOS/RealmeUI)| 500ms – 1,500ms | Enable "Allow background activity"; lock app in recent apps carousel. |
| **Google Pixel / Moto**| Pixel 6/7, Moto G-series | Android 13, 14, 15 (Stock AOSP) | 200ms – 600ms | Standard runtime permissions sufficient. |

---

## 2. OEM Battery Optimization Whitelist Guidance
To ensure Android does not kill the app when a telecaller switches to the native dialer during long calls:
1. **Samsung**:
   `Settings > Apps > Hi Talk > Battery > Unrestricted`.
2. **Xiaomi / Redmi (MIUI / HyperOS)**:
   `Settings > Apps > Manage Apps > Hi Talk > Autostart (ON) > Battery Saver: No restrictions`.
3. **Vivo**:
   `Settings > Battery > Background power consumption management > Hi Talk > High background power consumption`.
4. **Oppo / Realme**:
   `Settings > Battery > App Battery Management > Hi Talk > Allow background activity & Allow auto-launch`.

---

## 3. Real-Device Telecaller Verification Scenarios

### Scenario 1: Quick Cancelled Call (NeoDove-Grade Anti-Fraud Verification)
- **Step**: Agent taps "Call" on a lead. Native phone app opens. Agent immediately taps "Back" without tapping the green dial button.
- **Expected Outcome**: App returns to Lead Details. Zero duration recorded. Call attempt is NOT marked as connected and NOT counted towards dialer leaderboard.
- **Underlying Mechanism**: Android call log is reconciled with 3 bounded retries. Absence of outbound call log entry with matching timestamp results in `callPlaced: false`.

### Scenario 2: Successful 45-Second Connected Call
- **Step**: Agent dials lead. Customer answers and speaks for 45 seconds. Call ends. Agent returns to app.
- **Expected Outcome**: Lead disposition sheet automatically opens with `connected: true`, duration pre-filled to 45s. Agent selects stage (`INTERESTED`), adds remarks, and saves.

### Scenario 3: Customer Unanswered (Did Not Pick)
- **Step**: Agent dials lead. Phone rings for 30 seconds with no answer. Agent hangs up.
- **Expected Outcome**: App automatically detects 0s duration, marks `isCallConnected: false`, and pre-selects `NOT CONNECTED` with `DID_NOT_PICK`. Next retry is scheduled according to business hours.

### Scenario 4: Offline Call Logging & Recovery
- **Step**: Agent turns on Airplane Mode. Telecaller logs disposition with notes and deal value.
- **Expected Outcome**: Saved locally in `< 1ms`. Queue advances seamlessly. Outbox banner displays `Offline Mode • 1 changes queued`.
- **Step**: Airplane Mode turned off.
- **Expected Outcome**: `NetInfo` reconnect event triggers background replay. Lead disposition automatically syncs to backend API. Banner clears.
