// PnP
import { sp, RenderListDataOptions } from "@pnp/sp";
import { WebPartContext } from "@microsoft/sp-webpart-base";

import { SPHttpClient, SPHttpClientResponse, ISPHttpClientOptions } from '@microsoft/sp-http';
import { IGetListDataAsStreamResult, IRow } from './IOneDriveService';
import { GeneralHelper } from "../Utilities";
import { FileBrowserService } from "./FileBrowserService";
import { IFile, FilesQueryResult } from "./FileBrowserService.types";

export class OneDriveService extends FileBrowserService {
  protected oneDrivePersonalUrl: string;
  protected oneDriveRootFolderRelativeUrl: string;
  protected oneDriveRootFolderAbsoluteUrl: string;
  protected oneDrivePersonalLibraryTitle: string;

  constructor(context: WebPartContext) {
    super(context);

    this.oneDrivePersonalUrl = null;
    this.oneDriveRootFolderRelativeUrl = null;
    this.oneDriveRootFolderAbsoluteUrl = null;
    this.oneDrivePersonalLibraryTitle = null;
  }

  /**
   * Gets files from OneDrive personal library
   */
  public getListItems = async (libraryName: string, folderPath?: string, acceptedFilesExtensionsList?: string): Promise<FilesQueryResult> => {
    let filesQueryResult: FilesQueryResult = { items: [], nextHref: null };
    try {
      const oneDriveRootFolder = await this.getOneDriveRootFolderFullUrl();
      const encodedListUrl = encodeURIComponent(oneDriveRootFolder);

      folderPath = folderPath ? folderPath : this.oneDriveRootFolderRelativeUrl;
      const encodedFolderPath = encodeURIComponent(folderPath);

      const restApi: string = `${this.context.pageContext.web.absoluteUrl}/_api/SP.List.GetListDataAsStream?listFullUrl='${encodedListUrl}'&RootFolder=${encodedFolderPath}`;

      filesQueryResult = await this._getListDataAsStream(restApi, null, acceptedFilesExtensionsList);
    } catch (error) {
      filesQueryResult.items = null;
      console.error(error.message);
    }
    return filesQueryResult;
  }

  /**
     * Gets users one drive personal documents library path
     */
  public getOneDriveRootFolderFullUrl = async (): Promise<string> => {
    try {
      // Return result if already obtained
      if (this.oneDriveRootFolderAbsoluteUrl) {
        return this.oneDriveRootFolderAbsoluteUrl;
      }

      const oneDriveUrl = await this.getOneDrivePersonalUrl();
      if (!oneDriveUrl) {
        throw new Error(`Cannot obtain OneDrive personal URL.`);
      }
      const apiUrl: string = `${this.context.pageContext.web.absoluteUrl}/_api/SP.RemoteWeb(@a1)/Web/Lists?$filter=BaseTemplate eq 700 and BaseType eq 1&@a1='${encodeURIComponent(oneDriveUrl)}'`;
      const oneDriveFolderResult = await this.context.spHttpClient.get(apiUrl, SPHttpClient.configurations.v1, {
        headers: {
          "accept": "application/json;odata=nometadata",
          "content-type": "application/json;odata=nometadata",
          "odata-version": ""
        }
      });
      if (!oneDriveFolderResult || !oneDriveFolderResult.ok) {
        throw new Error(`Something went wrong when executing oneDriveRootFolder retrieve request. Status='${oneDriveFolderResult.statusText}'`);
      }

      const oneDriveLibsData = await oneDriveFolderResult.json();
      if (!oneDriveLibsData || !oneDriveLibsData.value || oneDriveLibsData.value.length == 0) {
        throw new Error(`Cannot read one drive libs data.`);
      }

      const myDocumentsLibrary = oneDriveLibsData.value[0];
      this.oneDrivePersonalLibraryTitle = myDocumentsLibrary.Title;
      this.oneDriveRootFolderRelativeUrl = `${myDocumentsLibrary.ParentWebUrl}/${myDocumentsLibrary.Title}`;
      this.oneDriveRootFolderAbsoluteUrl = `${this.oneDrivePersonalUrl}${myDocumentsLibrary.Title}`;
    } catch (error) {
      console.error(`[FileBrowserService.getOneDrivePersonalUrl] Err='${error.message}'`)
      this.oneDriveRootFolderAbsoluteUrl = null;
    }
    return this.oneDriveRootFolderAbsoluteUrl;
  }

  public getOneDriveRootFolderRelativeUrl = async (): Promise<string> => {
    if (!this.oneDriveRootFolderRelativeUrl) {
      await this.getOneDriveRootFolderFullUrl();
    }
    return this.oneDriveRootFolderRelativeUrl;
  }

  public getOneDrivePersonalLibraryTitle = async (): Promise<string> => {
    if (!this.oneDrivePersonalLibraryTitle) {
      await this.getOneDriveRootFolderFullUrl();
    }
    return this.oneDrivePersonalLibraryTitle;
  }

  /**
   * Gets personal site path.
   */
  protected getOneDrivePersonalUrl = async (): Promise<string> => {
    try {
      // Return result if already obtained
      if (this.oneDrivePersonalUrl) {
        return this.oneDrivePersonalUrl;
      }

      const userProfileApi = `${this.context.pageContext.web.absoluteUrl}/_api/SP.UserProfiles.ProfileLoader.GetProfileLoader/GetUserProfile`;
      const userProfileResult = await this.context.spHttpClient.post(userProfileApi, SPHttpClient.configurations.v1, {});

      if (!userProfileResult || !userProfileResult.ok) {
        throw new Error(`Something went wrong when executing user profile request. Status='${userProfileResult.statusText}'`);
      }

      const profileData = await userProfileResult.json();
      if (!profileData) {
        throw new Error(`Cannot read user profile data.`);
      }

      this.oneDrivePersonalUrl = profileData.FollowPersonalSiteUrl;
    } catch (error) {
      console.error(`[FileBrowserService.getOneDrivePersonalUrl] Err='${error.message}'`)
      this.oneDrivePersonalUrl = null;
    }
    return this.oneDrivePersonalUrl;
  }
}
