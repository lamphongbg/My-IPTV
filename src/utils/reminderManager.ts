// Utility to manage local channel reminders and category notifications
export interface ChannelReminder {
  channelId: string;
  channelName: string;
  category: string;
  createdAt: number;
  initialCategoryCount?: number;
}

export interface NewChannelAlertEvent {
  channelName: string;
  category: string;
  channelId?: string;
}

const STORAGE_REMINDERS_KEY = 'iptv_channel_reminders';
const STORAGE_CATEGORY_COUNTS_KEY = 'iptv_reminded_category_counts';

export function getReminders(): ChannelReminder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_REMINDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Error reading reminders from localStorage:', err);
    return [];
  }
}

export function isChannelReminded(channelId: string): boolean {
  const reminders = getReminders();
  return reminders.some((r) => r.channelId === channelId);
}

export function isCategoryReminded(category: string): boolean {
  if (!category) return false;
  const reminders = getReminders();
  const catLower = category.toLowerCase().trim();
  return reminders.some((r) => r.category.toLowerCase().trim() === catLower);
}

export function toggleReminder(
  channel: { id: string; name: string; group: string },
  currentCategoryCount: number = 0
): { isReminded: boolean; reminder: ChannelReminder | null } {
  if (typeof window === 'undefined') {
    return { isReminded: false, reminder: null };
  }

  const reminders = getReminders();
  const existingIndex = reminders.findIndex((r) => r.channelId === channel.id);

  if (existingIndex >= 0) {
    // Remove reminder
    reminders.splice(existingIndex, 1);
    try {
      localStorage.setItem(STORAGE_REMINDERS_KEY, JSON.stringify(reminders));
    } catch (e) {
      console.warn(e);
    }
    // Dispatch state change event
    window.dispatchEvent(
      new CustomEvent('iptv:reminder-toggled', {
        detail: { channelId: channel.id, isReminded: false, channelName: channel.name },
      })
    );
    return { isReminded: false, reminder: null };
  } else {
    // Add new reminder
    const newReminder: ChannelReminder = {
      channelId: channel.id,
      channelName: channel.name,
      category: channel.group,
      createdAt: Date.now(),
      initialCategoryCount: currentCategoryCount,
    };
    reminders.push(newReminder);
    try {
      localStorage.setItem(STORAGE_REMINDERS_KEY, JSON.stringify(reminders));

      // Also record the baseline count for this category
      const countsRaw = localStorage.getItem(STORAGE_CATEGORY_COUNTS_KEY);
      const counts = countsRaw ? JSON.parse(countsRaw) : {};
      counts[channel.group] = currentCategoryCount;
      localStorage.setItem(STORAGE_CATEGORY_COUNTS_KEY, JSON.stringify(counts));
    } catch (e) {
      console.warn(e);
    }

    // Dispatch state change event
    window.dispatchEvent(
      new CustomEvent('iptv:reminder-toggled', {
        detail: {
          channelId: channel.id,
          isReminded: true,
          channelName: channel.name,
          category: channel.group,
        },
      })
    );
    return { isReminded: true, reminder: newReminder };
  }
}

/**
 * Checks if a newly added channel belongs to any category with active reminders,
 * and if so, dispatches an alert event to display a toast notification.
 */
export function notifyNewChannelAdded(channel: {
  id?: string;
  name: string;
  group: string;
}) {
  if (typeof window === 'undefined') return;

  const reminders = getReminders();
  const catLower = (channel.group || '').toLowerCase().trim();
  const matchingReminders = reminders.filter(
    (r) => r.category.toLowerCase().trim() === catLower
  );

  if (matchingReminders.length > 0) {
    const alertData: NewChannelAlertEvent = {
      channelName: channel.name,
      category: channel.group,
      channelId: channel.id,
    };

    window.dispatchEvent(
      new CustomEvent('iptv:new-channel-alert', {
        detail: alertData,
      })
    );

    // Also persist last alert in sessionStorage/localStorage
    try {
      localStorage.setItem('iptv_latest_channel_alert', JSON.stringify(alertData));
    } catch {
      // Ignore
    }
  }
}

/**
 * Check if category counts have increased since baseline, and trigger toast if so.
 */
export function checkCategoryCountIncreases(
  latestCounts: Record<string, number>
): string[] {
  if (typeof window === 'undefined') return [];

  const reminders = getReminders();
  if (reminders.length === 0) return [];

  try {
    const countsRaw = localStorage.getItem(STORAGE_CATEGORY_COUNTS_KEY);
    const baselineCounts: Record<string, number> = countsRaw ? JSON.parse(countsRaw) : {};
    const alertedCategories: string[] = [];

    for (const reminder of reminders) {
      const cat = reminder.category;
      const currentCount = latestCounts[cat] || 0;
      const baseCount = baselineCounts[cat] ?? reminder.initialCategoryCount ?? currentCount;

      if (currentCount > baseCount) {
        alertedCategories.push(cat);
        // Update baseline count so we don't alert repeatedly
        baselineCounts[cat] = currentCount;

        // Dispatch alert
        window.dispatchEvent(
          new CustomEvent('iptv:new-channel-alert', {
            detail: {
              category: cat,
              channelName: `Kênh mới trong nhóm ${cat}`,
            },
          })
        );
      }
    }

    if (alertedCategories.length > 0) {
      localStorage.setItem(STORAGE_CATEGORY_COUNTS_KEY, JSON.stringify(baselineCounts));
    }

    return alertedCategories;
  } catch (err) {
    console.warn('Error checking category count increases:', err);
    return [];
  }
}
