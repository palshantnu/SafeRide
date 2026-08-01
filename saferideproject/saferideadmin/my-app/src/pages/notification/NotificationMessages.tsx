import { Bell } from 'lucide-react';
import AudienceMessageManager from '../_shared/AudienceMessageManager';
import {
  getAllNotifications, createNotification, updateNotification,
  deleteNotification, toggleNotificationStatus,
} from '../../services/api';

export default function NotificationMessages() {
  return (
    <AudienceMessageManager
      api={{
        getAll:       getAllNotifications,
        create:       createNotification,
        update:       updateNotification,
        toggleStatus: toggleNotificationStatus,
        remove:       deleteNotification,
      }}
      labels={{
        emoji:    '🔔',
        heading:  'Notifications',
        subtitle: 'Push notifications for users & captains',
        noun:     'Notification',
        icon:     Bell,
        module:   'notifications',
      }}
    />
  );
}
