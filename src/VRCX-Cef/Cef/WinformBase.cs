namespace VRCX.Cef;

internal class WinformBase : Form
{
    protected override void OnHandleCreated(EventArgs e)
    {
        if (!DesignMode)
        {
            WinformThemer.SetThemeToGlobal(this);
        }

        base.OnHandleCreated(e);
    }
}
