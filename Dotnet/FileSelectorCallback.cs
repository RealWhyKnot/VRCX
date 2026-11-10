#if LINUX
namespace VRCX;

public delegate Task<string> FileSelectorCallback(string defaultPath = "", string defaultExt = "", string defaultFilter = "All files (*.*)|*.*");
#endif
