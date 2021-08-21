import { OpenAPIV3 } from 'openapi-types'
import Paw from 'types/paw'
import EnvironmentManager from './environment'
import { convertEnvString } from './dynamic-values'
import logger from './console'
import parseURL from'url';

export interface PawURLOptions {
  openApi: OpenAPIV3.Document
  pathItem: OpenAPIV3.PathItemObject
  envManager: EnvironmentManager
  pathName: string
  request: Paw.Request
}

export default class PawURL {
  public hostname: string
  public pathname: string
  public port: string
  public fullUrl: string | DynamicString
  constructor(
    pathItem: OpenAPIV3.PathItemObject,
    openApi: OpenAPIV3.Document,
    pathName: string,
    envManager: EnvironmentManager,
    request: Paw.Request,
  ) {
    const fakeBaseUrlObj = new URL('x://-');
    let urlObj = fakeBaseUrlObj;
    if (openApi.servers && openApi.servers.length > 0) {
      urlObj = appendURL(openApi.servers[0].url, urlObj);
    }
    if (pathItem.servers && pathItem.servers.length > 0) {
      urlObj = appendURL(pathItem.servers[0].url, urlObj);
    }

    urlObj = appendURL(pathName, urlObj);

    let urlStr = urlObj.href.replace(/%7B/g, '{').replace(/%7D/g, '}')
    if (urlStr.startsWith(fakeBaseUrlObj.href)) {
      urlStr = `{Base URL}${urlStr.substring(fakeBaseUrlObj.href.length)}`
    }

    this.hostname = urlObj.hostname
    this.pathname = urlObj.pathname
    this.port = urlObj.port

    this.fullUrl = convertEnvString(urlStr, request, envManager) as DynamicString
    return this
  }
}

function appendURL(url: string, baseUrl: URL) {
  return new URL(url, baseUrl.href.endsWith('/')? baseUrl.href : `${baseUrl.href}/`)
}