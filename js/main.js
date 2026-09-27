const menuPanel = document.querySelector(".menu-panel");
const chatPanel = document.querySelector(".chat-panel");
const nameDisplay = document.querySelector(".profile-display .name");
const roomInput = document.querySelector(".room-input input");
const chatTitleEl = document.querySelector(".chat-header .title");
const roomList = document.getElementById("roomList");
const messagesContainer = document.getElementById("messagesContainer");
const messageInput = document.getElementById("messageInput");

let currentUser = null;
let currentRoom = null;
let signInMethod = "anonymous";

document.addEventListener("DOMContentLoaded", () => {
  authenticateUser();
});

function updateUI() {
  chatTitleEl.textContent = currentRoom ? `# ${currentRoom}` : "Room name";
  document.querySelectorAll(".room-list .item.active").forEach((el) => el.classList.remove("active"));
  document.querySelector(`.room-list .item[data-room="${currentRoom}"]`)?.classList?.add("active");
  menuPanel.classList.toggle("md-hidden", currentRoom);
}

// Authentication Pre-flight Setup
async function authenticateUser() {
  if (signInMethod === "anonymous") {
    await auth.signInAnonymously();
  } else if (signInMethod === "google") {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  }
}

// Authentication State Listener
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user;
    let displayName = user.displayName;

    if (!displayName) {
      displayName = "User_" + user.uid.substring(0, 4);
      try {
        await user.updateProfile({ displayName });
      } catch (err) {
        console.error("Error updating default profile:", err);
      }
    }

    nameDisplay.textContent = displayName;

    enterRoom();
  }
});

function renderMessages(messages) {
  messagesContainer.innerHTML = messages
    .map((msg) => {
      const timestamp = msg.timestamp;
      if (!timestamp) return "";

      const isSelf = currentUser && msg.uid === currentUser.uid;

      const timeString = getTimeString(msg.timestamp.seconds);
      const senderName = isSelf ? "You" : escapeHTML(msg.senderName || "Anonymous");
      const messageBody = escapeHTML(msg.text || "");

      return `
      <div class="message ${isSelf ? "sent" : "received"}">
        <div class="message-meta">${senderName}${timeString}</div>
        <div class="message-body">${messageBody}</div>
      </div>
    `;
    })
    .join("");

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle sending messages
async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentUser) return;

  messageInput.value = "";

  const roomRef = db.collection("rooms").doc(currentRoom).collection("messages");

  // Calculate expiration time (e.g., 24 hours into the future)
  const EXPIRATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const expireDate = new Date(Date.now() + EXPIRATION_TTL_MS);

  await roomRef.add({
    text: text,
    uid: currentUser.uid,
    senderName: currentUser.displayName || "Anonymous",
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    expireAt: firebase.firestore.Timestamp.fromDate(expireDate),
  });
}

async function enterRoom(room) {
  room = room || roomInput.value || "general";
  currentRoom = room;

  updateUI();

  await cleanupExpiredMessages();
  listenForMessages(currentRoom);
}

// Edit profile handler
async function editProfile() {
  const currentName = currentUser?.displayName || "";
  const newName = prompt("Enter your new user name:", currentName);

  if (newName && newName.trim() !== "" && currentUser) {
    await currentUser.updateProfile({ displayName: newName.trim() });
    nameDisplay.textContent = newName.trim();
  }
}

async function cleanupExpiredMessages() {
  try {
    const nowTimestamp = firebase.firestore.Timestamp.now();

    // 1. Target ALL "messages" subcollections across every room
    const expiredQuery = await db.collectionGroup("messages").where("expireAt", "<=", nowTimestamp).get({ source: "server" }); // Avoids cache assertion errors

    if (expiredQuery.empty) return;

    // 2. Delete found documents in batches (Firestore allows up to 500 per batch)
    const batch = db.batch();
    expiredQuery.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Universal cleanup removed ${expiredQuery.size} expired message(s).`);
  } catch (err) {
    // If you see an index requirement error, check the browser console for the direct creation link
    console.warn("Universal cleanup error:", err.message);
  }
}

function toggleMenuPanel() {
  menuPanel.classList.toggle("md-hidden");
}
