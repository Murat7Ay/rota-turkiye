// Web Notification yardımcıları. İzin yalnızca kullanıcı bir düğmeye bastığında istenir.
// Android Chrome'da `new Notification` yasak olduğu için önce service worker üzerinden denenir.

export type NotifyPermission = NotificationPermission | "unsupported";

export function notificationPermission(): NotifyPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotifyPermission> {
  if (notificationPermission() === "unsupported") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

const icon = `${import.meta.env.BASE_URL}icon.svg`;

export async function showNotification(title: string, body: string, tag?: string): Promise<boolean> {
  if (notificationPermission() !== "granted") return false;
  const opts: NotificationOptions = { body, icon, badge: icon, tag, lang: "tr" };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      await reg.showNotification(title, opts);
      return true;
    }
  } catch {
    /* aşağıda dene */
  }
  try {
    new Notification(title, opts);
    return true;
  } catch {
    return false;
  }
}
