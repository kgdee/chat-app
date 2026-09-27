// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD6esVHV9NEQ9hmhg8Zg4bkM-Y4556d1BQ",
  authDomain: "chat-app-c2ea0.firebaseapp.com",
  projectId: "chat-app-c2ea0",
  storageBucket: "chat-app-c2ea0.firebasestorage.app",
  messagingSenderId: "395478462515",
  appId: "1:395478462515:web:e56a27cbadbe5232b27346",
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let unsubscribeListener = null;

// Listen for Firestore real-time updates on active channel
function listenForMessages(room) {
  if (unsubscribeListener) {
    unsubscribeListener();
  }

  const roomRef = db.collection("rooms").doc(room).collection("messages");

  unsubscribeListener = roomRef.onSnapshot(
    (snapshot) => {
      const messageList = [];
      snapshot.forEach((doc) => {
        messageList.push({ id: doc.id, ...doc.data() });
      });

      // Client-side sorting by timestamp (Rule 2: avoid compound query indexes)
      messageList.sort((a, b) => {
        const tA = a.timestamp?.seconds || 0;
        const tB = b.timestamp?.seconds || 0;
        return tA - tB;
      });

      renderMessages(messageList);
    },
    (error) => {
      console.error("Firestore listener error:", error);
    },
  );
}
