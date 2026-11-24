# VRCX

Experimental VRCX features and cleanup.

This is my personal fork of VRCX, kept for my own setup. Changes land when I need them, and it may differ from the original VRCX project or lag behind it. If you want the standard app, use the original. You're welcome to try this one, but it isn't built for anyone else's setup. See [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

## What this fork changes

- Update checks and the in-app releases link point at this fork's releases page.
- API requests go through a queue with limits per endpoint group, and back off when VRChat reports a rate limit.
- On first start, your existing database is copied into a new file, missing indexes are added, and the old file is left in place.
- It keeps history that VRChat later removes or overwrites: profile bio, pronouns and tags, badges, avatars people were seen wearing, favorite changes, past friend requests and invite replies. Kept history shows in the user dialog and in favorites.
- The Tools page has three new pages: Instance Browser, Instance Log and Who You Meet (familiar faces, friend meetups, time online together and vote kicks).
- Dialogs show more VRChat data, such as an avatar analysis card, a group's next event and a user's subscription status. Instance dialogs show the faces of the people in them.
- The code is TypeScript, images use SkiaSharp instead of ImageSharp, the C# projects sit under `src`, and CI runs stricter lint and style checks.

## Install

Download `VRCX_<version>_Setup_x64.exe` (or the matching zip) from the [Releases](https://github.com/RealWhyKnot/VRCX/releases) page.

## Build

See [Building and testing](CONTRIBUTING.md#building-and-testing).

## License

MIT, like the original project. See [LICENSE](LICENSE).
