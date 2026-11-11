using System.Reflection;
using CefSharp.JavascriptBinding;

namespace VRCX.Cef;

internal sealed class BridgeNameConverter : IJavascriptNameConverter
{
    public string ConvertToJavascript(MemberInfo memberInfo)
    {
        return memberInfo.Name switch
        {
            "GetZoomAsync" => "GetZoom",
            "OpenFolderSelectorDialogAsync" => "OpenFolderSelectorDialog",
            "OpenFileSelectorDialogAsync" => "OpenFileSelectorDialog",
            "TryOpenInstanceInVrcAsync" => "TryOpenInstanceInVrc",
            "GetImageAsync" => "GetImage",
            "CropAllPrintsAsync" => "CropAllPrints",
            "CropPrintImageAsync" => "CropPrintImage",
            "SavePrintToFileAsync" => "SavePrintToFile",
            "SaveStickerToFileAsync" => "SaveStickerToFile",
            "SaveEmojiToFileAsync" => "SaveEmojiToFile",
            "DownloadUpdateAsync" => "DownloadUpdate",
            _ => memberInfo.Name,
        };
    }

    public string ConvertReturnedObjectPropertyAndFieldToNameJavascript(MemberInfo memberInfo) => memberInfo.Name;
}
