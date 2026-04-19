import type { models } from '../../wailsjs/go/models';
import { wailsGateway } from '../platform/app-api/wailsGateway';

export const GetBookmarks = (profileName: string, dbName: string) => wailsGateway.GetBookmarks(profileName, dbName);
export const GetBookmarksByConnection = (connectionID: string) => wailsGateway.GetBookmarksByConnection(connectionID);
export const SaveBookmark = (profileName: string, dbName: string, bookmark: models.Bookmark) =>
    wailsGateway.SaveBookmark(profileName, dbName, bookmark);
export const DeleteBookmark = (profileName: string, dbName: string, lineNumber: number) =>
    wailsGateway.DeleteBookmark(profileName, dbName, lineNumber);
