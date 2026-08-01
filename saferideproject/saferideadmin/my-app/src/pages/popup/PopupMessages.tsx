import { MessageSquare } from 'lucide-react';
import AudienceMessageManager from '../_shared/AudienceMessageManager';
import {
  getAllPopups, createPopup, updatePopup, deletePopup, togglePopupStatus,
} from '../../services/api';

export default function PopupMessages() {
  return (
    <AudienceMessageManager
      api={{
        getAll:       getAllPopups,
        create:       createPopup,
        update:       updatePopup,
        toggleStatus: togglePopupStatus,
        remove:       deletePopup,
      }}
      labels={{
        emoji:    '💬',
        heading:  'Pop-up Messages',
        subtitle: 'In-app pop-ups for users & captains',
        noun:     'Pop-up',
        icon:     MessageSquare,
        module:   'popups',
      }}
    />
  );
}
