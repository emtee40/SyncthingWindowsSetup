// SetSyncthingConfig.js
// Written by Bill Stewart (bstewart AT iname.com) for Syncthing

// Notes:
// * Generate config.xml if doesn't exist (firewall rule must already exist)
// * Set config.xml options requested by parameters
// * Disable config.xml setLowPriority option

// BEGIN LOCALIZATION
var MSG_DLG_TITLE               = "Syncthing";
var MSG_FIREWALL_RULE_NOT_FOUND = "Firewall rule not found";
var MSG_SYNCTHING_NOT_FOUND     = "syncthing.exe not found";
var MSG_CONFIG_NOT_FOUND        = "File not found:";
var MSG_CONFIG_NOT_UPDATED      = "Unable to update config.xml";
var LOCALSERVICE_APPDATA_PATH   = "ServiceProfiles\\LocalService\\AppData\\Local";
// END LOCALIZATION

// Global Win32 API constants
var ERROR_FILE_NOT_FOUND = 2;
var MB_ICONERROR         = 0x10;
// Shell.Application constants
var ssfLOCALAPPDATA = 28;
var ssfWINDOWS      = 36;
// Global objects
var Args           = WScript.Arguments;
var FSO            = new ActiveXObject("Scripting.FileSystemObject");
var NetFWPolicy2   = new ActiveXObject("HNetCfg.FWPolicy2");
var ShellApp       = new ActiveXObject("Shell.Application");
var WshShell       = new ActiveXObject("WScript.Shell");
var XMLDOMDocument = new ActiveXObject("Microsoft.XMLDOM");
// Global variables
var ScriptPath             = WScript.ScriptFullName.substring(0,WScript.ScriptFullName.length - WScript.ScriptName.length);
var CurrentUserConfigPath  = FSO.BuildPath(ShellApp.NameSpace(ssfLOCALAPPDATA).Self.Path,"Syncthing");
var LocalServiceConfigPath = FSO.BuildPath(FSO.BuildPath(ShellApp.NameSpace(ssfWINDOWS).Self.Path,LOCALSERVICE_APPDATA_PATH),"Syncthing");

function help() {
  WScript.Echo("Usage: " + WScript.ScriptName + " {/currentuser|/localservice} <settings> [/silent]");
}

function firewallRuleExists(executablePath) {
  var result = false;
  try {
    var netFWRules = new Enumerator(NetFWPolicy2.Rules);
    for ( ; ! netFWRules.atEnd(); netFWRules.moveNext() ) {
      result = netFWRules.item().ApplicationName.toLowerCase() == executablePath.toLowerCase();
      if ( result ) {
        break;
      }
    }
  }
  catch(err) {
  }
  return result;
}

function paramIsEmpty(paramName) {
  return (Args.Named.Item(paramName) == "") || (Args.Named.Item(paramName) == null);
}

function main() {
  if ( Args.Named.Exists("currentuser") ) {
    var configDir = CurrentUserConfigPath;
    var defaultFolder = true;
  }
  else if ( Args.Named.Exists("localservice") ) {
    var configDir = LocalServiceConfigPath;
    var defaultFolder = false;
  }
  else {
    help();
    return;
  }

  var configFileName = FSO.BuildPath(configDir,"config.xml");
  if ( ! FSO.FileExists(configFileName) ) {
    var syncthingPath = FSO.BuildPath(ScriptPath,"syncthing.exe");
    // syncthing.exe chats on network, so abort if we can't find a firewall
    // rule for it (avoids Windows prompt to create firewall rules)
    if ( ! firewallRuleExists(syncthingPath) ) {
      if ( ! Args.Named.Exists("silent") ) {
        WshShell.Popup(MSG_FIREWALL_RULE_NOT_FOUND,0,MSG_DLG_TITLE,MB_ICONERROR);
      }
      return ERROR_FILE_NOT_FOUND;
    }
    if ( ! FSO.FileExists(syncthingPath) ) {
      if ( ! Args.Named.Exists("silent") ) {
        WshShell.Popup(MSG_SYNCTHING_NOT_FOUND,0,MSG_DLG_TITLE,MB_ICONERROR);
      }
      return ERROR_FILE_NOT_FOUND;
    }
    var cmdLine = '"' + syncthingPath + '" generate';
    if ( ! defaultFolder ) {
      cmdLine += ' --no-default-folder';
    }
    // Generate configuration
    WshShell.Run(cmdLine,0,true);
    if ( ! FSO.FileExists(configFileName) ) {
      if ( ! Args.Named.Exists("silent") ) {
        WshShell.Popup(MSG_CONFIG_NOT_FOUND + "\n\n" + configFileName,0,MSG_DLG_TITLE,MB_ICONERROR);
      }
      return ERROR_FILE_NOT_FOUND;
    }
  }

  // Set configuration options
  var xmlElement = null;
  var configValue = null;
  try {
    XMLDOMDocument.load(configFileName);
    // Configure GUI address
    if ( Args.Named.Exists("guiaddress") ) {
      xmlElement = XMLDOMDocument.selectSingleNode("//configuration/gui/address");
      configValue = Args.Named.Item("guiaddress");
      if ( xmlElement.text != configValue ) {
        xmlElement.text = paramIsEmpty("guiaddress") ? "127.0.0.1:8384" : configValue;
        XMLDOMDocument.save(configFileName);
      }
    }
    // Configure autoUpgradeIntervalH
    if ( Args.Named.Exists("autoupgradeinterval") ) {
      xmlElement = XMLDOMDocument.selectSingleNode("//configuration/options/autoUpgradeIntervalH");
      configValue = Args.Named.Item("autoupgradeinterval");
      xmlElement.text = paramIsEmpty("autoupgradeinterval") ? "12" : configValue;
      XMLDOMDocument.save(configFileName);
    }
    // Configure setLowPriority
    xmlElement = XMLDOMDocument.selectSingleNode("//configuration/options/setLowPriority");
    if ( xmlElement.text.toLowerCase() != "false" ) {
      xmlElement.text = "false";
      XMLDOMDocument.save(configFileName);
    }
  }
  catch(err) {
    if ( ! Args.Named.Exists("silent") ) {
      WshShell.Popup(MSG_CONFIG_NOT_UPDATED,0,MSG_DLG_TITLE,MB_ICONERROR);
    }
    return err.number;
  }
}

WScript.Quit(main());
