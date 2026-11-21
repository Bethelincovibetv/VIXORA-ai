export const clearVideoHistory = () => {
  localStorage.removeItem('vixora_video_history');
  localStorage.removeItem('vixora_projects');
  localStorage.removeItem('vixora_text_chat_history');
};

export const persistVideoHistory = (data: any) => {
  try {
    localStorage.setItem('vixora_video_history', JSON.stringify(data));
  } catch (e) {
    console.error('Failed to persist video history', e);
  }
};

export const getPersistedVideoHistory = () => {
  try {
    const data = localStorage.getItem('vixora_video_history');
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};