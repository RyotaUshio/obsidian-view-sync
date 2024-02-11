# Obsidian View Sync

This is an [Obsidian.md](https://obsidian.md) plugin for **synchronizing the state of the active view or workspace layouts** among devices.

It does NOT sync _files_, unlike Obsidian Sync. It syncs the state of the active view (e.g. file opened) or workspace layouts (e.g. arrangement of tabs and windows).

## Preparation

View Sync assumes the files in your vault are already synchronized using some other real-time sync solutions such as:

- [Obsidian Sync](https://obsidian.md/sync)
- [Self-hosted LiveSync](https://github.com/vrtmrz/obsidian-livesync)

So you need to set up one before using this plugin. After that, configure View Sync on all the devices according to your use case. I will show you a typical example below.

## How it works

In View Sync, a device is **followed** by one or more other devices. Here I call the followed one the **main device**.

The state of the main device's active view is tracked by a plain text file in your vault. 
You can specify its path in the plugin settings.
It can be anything; let's say `view-sync-desktop.json` for example.

The file `view-sync-desktop.json` stores information about the state of the active view at each moment.
Each time you focus on a new tab on the main device, `view-sync-desktop.json` is updated.

Since files are synchronized via a service like Obsidian Sync, the updated `view-sync-desktop.json` is also sent to the follower devices as well.
When `view-sync-desktop.json` is updated in a follower device, View Sync reflects the view state saved in it to the active tab in the follower device.
As a result, the follower device can always keep up with the main device.

## Example: seamless PDF handwriting workflow

Set up View Sync both on a desktop device and your iPad according to the following.
In this case, the iPad is a follower of the desktop.

Then, every time you open a PDF file on the desktop, the same PDF will be also opened on your iPad, and the "Share" menu (see below) will pop up at the same time.
You can start handwriting or drawing by selecting _[Markup](https://support.apple.com/en-us/HT206885)_. After finishing handwriting, tap _Done_ > _Delete PDF_ (I know, it's confusing).
It will save the handwriting to the original PDF file, and it will immediately appear in Obsidian's PDF viewer on your iPad. Moreover, it will also reflected soon on the desktop thanks to Obsidian Sync (or any other sync solutions of your choice).

<img src="https://github.com/RyotaUshio/obsidian-view-sync/assets/72342591/b691aab8-40c9-4fd1-8d5c-de4d6579d8db" alt="Share menu" width=300>

### Desktop settings

Since the desktop is the main device in this example, you only have to fill in the first option.

![Desktop settings](https://github.com/RyotaUshio/obsidian-view-sync/assets/72342591/18f9d4d2-b3eb-409b-a628-e941af9cb808)

### iPad settings

Your iPad is just a follower device, so you don't have to fill in the first option.
Instead, all the other options need to be specified.

- *View types to watch*: we want to sync PDF views only, so we write `pdf` here.
- *Follow another device*: turn it on because this device is a follower device.
- *Path of the active view state file for the followed device*: write the file path that you specified in the desktop settings.
- *Show "Share" menu after sync*: this is optional, but it will definitely make the workflow smoother in this case!

![iPad settings](https://github.com/RyotaUshio/obsidian-view-sync/assets/72342591/3c198362-718e-4353-88c4-dbcfd4a94bdf)

### Obsidian Sync settings

In this example, the active view state file is a `.json` file. In order to sync `.json` file with Obsidian Sync, you need to enable the _Sync all other types_ option.

Note that the file extension does not need to be `.json`. If you choose `.md`, you don't need to enable this option although the active view state file might clutter search results.

![Obsidian Sync settings](https://github.com/RyotaUshio/obsidian-view-sync/assets/72342591/86f8196e-41a0-4779-81c0-02975fbe6223)

## Installation

Since this plugin is still in its beta, it's not available in the community plugin browser yet.

But you can install the latest release using [BRAT](https://github.com/TfTHacker/obsidian42-brat).

1. Install the latest version of BRAT and enable it.
2. _(Optional but highly recommended)_ In the BRAT settings, turn on `Auto-update plugins at startup` at the top of the page.
3. Open the following URL in the browser: `obsidian://brat?plugin=RyotaUshio/obsidian-view-sync`.
4. Click the "Add Plugin" button.

## Support development

If you find [my plugins](https://ryotaushio.github.io/the-hobbyist-dev/) useful, please support my work to ensure they continue to work!

<a href="https://github.com/sponsors/RyotaUshio" target="_blank"><img src="https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86" alt="GitHub Sponsors" style="width: 180px; height:auto;"></a>

<a href="https://www.buymeacoffee.com/ryotaushio" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="width: 180px; height:auto;"></a>

<a href='https://ko-fi.com/E1E6U7CJZ' target='_blank'><img height='36' style='border:0px; width: 180px; height:auto;' src='https://storage.ko-fi.com/cdn/kofi2.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>
