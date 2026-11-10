#if LINUX
namespace VRCX;

public delegate Task<string> FolderSelectorCallback(string defaultPath = "");
#endif
