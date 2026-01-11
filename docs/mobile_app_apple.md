# Task: App Store Rejection Analysis & Remediation Plan

**Context**
I have received a rejection from Apple App Review for my iOS app "ArchePal". Below are the specific guidelines cited and the details provided by the reviewer.

**Input: Rejection Details**

> **Guideline 2.1 - Performance - App Completeness**
> *Issue:* The app exhibited bugs negatively impacting users.
> *Specific Bug:* All buttons under Settings were unresponsive on tapping.
> *Device:* iPad Air (5th generation), iPadOS 26.1
>
> **Guideline 5.1.1(v) - Data Collection and Storage**
> *Issue:* The app supports account creation but lacks an account deletion option.
> *Requirement:* Apps must offer account deletion (not just deactivation) and provided a direct link if a website visit is required.
>
> **Guideline 3.2.2 - Business - Other Business Model Issues**
> *Issue:* The app collects charitable donations within the app but the organization is not an approved nonprofit.
> *Apple's Suggestion:* Use a link to a website (Safari) or SMS for donations if not an approved nonprofit.

---

**Instructions for Claude**

Please review the rejection issues above and generate a comprehensive **Action Plan**. For each guideline, please provide:

1.  **Technical Analysis:**
    * **For 2.1 (Settings Bug):** Suggest potential causes for unresponsive buttons specifically on iPad/iPadOS (e.g., layout constraints, hit-testing issues, UIWindow scene delegate issues).
    * **For 5.1.1(v) (Account Deletion):** Outline the necessary backend and frontend changes to implement a compliant deletion flow.
    * **For 3.2.2 (Donations):** Explain how to change the donation flow to be compliant (e.g., removing the in-app purchase flow for donations and replacing it with an external URL handler).

2.  **Step-by-Step Remediation Plan:**
    * Create a checklist of tasks I need to complete in Xcode and my backend.

3.  **Draft Replies to App Review:**
    * Write a professional response for each point to be posted in the App Store Connect Resolution Center, explaining the fixes we have made.

4.  **QA/Testing Strategy:**
    * What specific tests should I run (especially for the iPad issue) to ensure this doesn't happen again?



---
  App Store Review Submission Notes - ArchePal

  Issues Addressed from Previous Rejection

  ---
  1. Guideline 2.1 - Performance - App Completeness (Settings Bug)

  Issue: All buttons under Settings were unresponsive on iPad Air (5th generation), iPadOS 26.1.

  Resolution:
  - Added onClick handlers to all Settings buttons (General Settings, Notifications, Privacy & Security, Help & Support)
  - Each button now displays a "Coming Soon" notification informing users that the feature will be available in a future update
  - Additional non-functional buttons throughout the app (Request New Analysis, Team Invite, Team Message) have also been updated to provide user feedback
  - All interactive elements are now responsive on iPad devices

  Files Modified:
  - src/pages/Account.tsx
  - src/pages/Analysis.tsx
  - src/pages/Team.tsx

  ---
  2. Guideline 5.1.1(v) - Data Collection and Storage (Account Deletion)

  Issue: The app supports account creation but lacks an account deletion option.

  Resolution:
  - Implemented complete in-app account deletion functionality
  - Added "Delete Account" button in the Account/Settings page with clear destructive styling
  - Implemented confirmation dialog warning users that the action is permanent and irreversible
  - Account deletion process:
    a. Deletes all user data from Firestore database (profile, profile picture)
    b. Permanently deletes Firebase Authentication account
    c. Redirects user to sign-in page with confirmation message
  - Handles edge cases including re-authentication requirements

  Files Modified:
  - src/pages/Account.tsx - Added Delete Account UI with AlertDialog
  - src/hooks/use-auth.tsx - Added deleteAccount function
  - src/services/archaeologists.ts - Added deleteUserData function for data cleanup

  ---
  3. Guideline 3.2.2 - Business - Other Business Model Issues (Donations)

  Issue: The app collects charitable donations within the app but the organization is not an approved nonprofit.

  Resolution:
  - Removed all in-app payment collection (credit card form, billing details, CVV input)
  - Replaced with an external donation link that opens in Safari via Capacitor Browser plugin
  - Users are now redirected to our external website (https://www.archepal.com/#/donations) to complete donations securely
  - Clear messaging informs users they will be redirected to complete their donation

  Files Modified:
  - src/pages/Donations.tsx - Complete rewrite to remove payment form
  - package.json - Added @capacitor/browser dependency

  ---
  Additional Improvements

  - Fixed Firestore "invalid-argument" error when updating user profiles with undefined values
  - Updated Contact Us page with correct email address (fllseason2526@gmail.com)
  - Improved Sign In button visibility with white text color
  - All app icons (iOS and Android) verified to have correct "ARCHAEOLOGY" spelling

  ---
  Testing Performed

  1. iPad Testing: Verified all Settings buttons are responsive on iPad
  2. Account Deletion: Tested complete deletion flow including data cleanup
  3. Donation Flow: Confirmed external browser opens correctly with donation URL
  4. Cross-device: Tested on multiple iOS device simulators

  ---
  Contact

  For any questions regarding this submission, please contact: fllseason2526@gmail.com

  ---