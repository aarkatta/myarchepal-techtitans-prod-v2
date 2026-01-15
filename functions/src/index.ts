import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * Cloud Function to delete a user from Firebase Authentication
 * This can only be called by authenticated users who are org admins
 */
export const deleteUserFromAuth = functions.https.onCall(async (data, context) => {
  // Check if the request is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const { userId, organizationId } = data;

  // Validate required fields
  if (!userId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with a userId."
    );
  }

  if (!organizationId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with an organizationId."
    );
  }

  // Get the caller's user document to verify they are an admin
  const callerUid = context.auth.uid;
  const db = admin.firestore();

  try {
    // Check if caller is an org admin
    const callerDoc = await db.collection("users").doc(callerUid).get();
    if (!callerDoc.exists) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Caller user not found."
      );
    }

    const callerData = callerDoc.data();
    const callerRole = callerData?.role;
    const callerOrgId = callerData?.organizationId;

    // Verify caller has admin permissions
    if (callerRole !== "ORG_ADMIN" && callerRole !== "SUPER_ADMIN") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only organization admins can delete users."
      );
    }

    // Verify caller is in the same organization
    if (callerOrgId !== organizationId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You can only delete users from your own organization."
      );
    }

    // Prevent self-deletion
    if (userId === callerUid) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "You cannot delete yourself."
      );
    }

    // Get the user to be deleted
    const userToDeleteDoc = await db.collection("users").doc(userId).get();
    if (!userToDeleteDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "User to delete not found."
      );
    }

    const userToDeleteData = userToDeleteDoc.data();

    // Prevent deleting super admins
    if (userToDeleteData?.role === "SUPER_ADMIN") {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Super Admins cannot be deleted."
      );
    }

    // Verify user is in the same organization
    if (userToDeleteData?.organizationId !== organizationId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "User is not in your organization."
      );
    }

    // Delete the user from Firebase Authentication
    await admin.auth().deleteUser(userId);

    console.log(`✅ User ${userId} deleted from Firebase Authentication by ${callerUid}`);

    return {
      success: true,
      message: `User ${userId} has been deleted from Authentication`,
    };
  } catch (error: any) {
    console.error("Error deleting user from Auth:", error);

    // If it's already an HttpsError, rethrow it
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    // Handle specific Firebase Auth errors
    if (error.code === "auth/user-not-found") {
      // User already doesn't exist in Auth, that's okay
      return {
        success: true,
        message: "User was already removed from Authentication",
      };
    }

    throw new functions.https.HttpsError(
      "internal",
      error.message || "Failed to delete user from Authentication"
    );
  }
});
