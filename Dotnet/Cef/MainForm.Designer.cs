using System;
using System.ComponentModel;
using System.Drawing;
using System.Windows.Forms;

namespace VRCX
{
    partial class MainForm
    {
        private IContainer components = null;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }

            base.Dispose(disposing);
        }


        private void InitializeComponent()
        {
            this.components = new Container();
            this.TrayMenu = new ContextMenuStrip(this.components);
            this.TrayMenu_Open = new ToolStripMenuItem();
            this.TrayMenu_DevTools = new ToolStripMenuItem();
            this.TrayMenu_ForceCrash = new ToolStripMenuItem();
            this.TrayMenu_Separator = new ToolStripSeparator();
            this.TrayMenu_Quit = new ToolStripMenuItem();
            this.TrayIcon = new NotifyIcon(this.components);
            this.TrayMenu.Font = new Font("Segoe UI", 9F, FontStyle.Regular, GraphicsUnit.Point, ((byte)(0)));

            this.TrayMenu.SuspendLayout();
            this.SuspendLayout();
            this.TrayMenu.Items.Add(this.TrayMenu_Open);
            this.TrayMenu.Items.Add(this.TrayMenu_DevTools);
            if (Program.LaunchDebug)
                this.TrayMenu.Items.Add(this.TrayMenu_ForceCrash);
            this.TrayMenu.Items.Add(this.TrayMenu_Separator);
            this.TrayMenu.Items.Add(this.TrayMenu_Quit);

            this.TrayMenu.Name = "TrayMenu";
            this.TrayMenu.Size = new Size(132, 54);
            this.TrayMenu_Open.Name = "TrayMenu_Open";
            this.TrayMenu_Open.Size = new Size(131, 22);
            this.TrayMenu_Open.Text = "Open";
            this.TrayMenu_Open.Click += new EventHandler(this.TrayMenu_Open_Click);
            this.TrayMenu_DevTools.Name = "TrayMenu_DevTools";
            this.TrayMenu_DevTools.Size = new Size(131, 22);
            this.TrayMenu_DevTools.Text = "DevTools";
            this.TrayMenu_DevTools.Click += new EventHandler(this.TrayMenu_DevTools_Click);
            this.TrayMenu_ForceCrash.Name = "TrayMenu_ForceCrash";
            this.TrayMenu_ForceCrash.Size = new Size(131, 22);
            this.TrayMenu_ForceCrash.Text = "Force Crash";
            this.TrayMenu_ForceCrash.Click += new EventHandler(this.TrayMenu_ForceCrash_Click);
            this.TrayMenu_Separator.Name = "TrayMenu_Separator";
            this.TrayMenu_Separator.Size = new Size(128, 6);
            this.TrayMenu_Quit.Name = "TrayMenu_Quit";
            this.TrayMenu_Quit.Size = new Size(131, 22);
            this.TrayMenu_Quit.Text = "Quit VRCX";
            this.TrayMenu_Quit.Click += new EventHandler(this.TrayMenu_Quit_Click);
            this.TrayIcon.ContextMenuStrip = this.TrayMenu;
            this.TrayIcon.Text = "VRCX";
            this.TrayIcon.Visible = true;
            this.TrayIcon.MouseClick += new MouseEventHandler(this.TrayIcon_MouseClick);
            this.AutoScaleDimensions = new SizeF(96F, 96F);
            this.AutoScaleMode = AutoScaleMode.Dpi;
            this.ClientSize = new Size(842, 561);
            this.MinimumSize = new Size(320, 240);
            this.Name = "MainForm";
            this.StartPosition = FormStartPosition.CenterScreen;
            this.Text = Program.Version;
            this.FormClosing += new FormClosingEventHandler(this.MainForm_FormClosing);
            this.FormClosed += new FormClosedEventHandler(this.MainForm_FormClosed);
            this.Load += new EventHandler(this.MainForm_Load);
            this.Move += new EventHandler(this.MainForm_Move);
            this.Resize += new EventHandler(this.MainForm_Resize);
            this.TrayMenu.ResumeLayout(false);
            this.ResumeLayout(false);
        }


        private ContextMenuStrip TrayMenu;
        private ToolStripMenuItem TrayMenu_Open;
        private ToolStripMenuItem TrayMenu_DevTools;
        private ToolStripMenuItem TrayMenu_ForceCrash;
        private ToolStripSeparator TrayMenu_Separator;
        private ToolStripMenuItem TrayMenu_Quit;
        private NotifyIcon TrayIcon;
    }
}
