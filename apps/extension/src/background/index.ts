chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.set({ flowdiffInstalled: true });
});
