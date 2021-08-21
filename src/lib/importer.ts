import Yaml from 'yaml'
import SwaggerParser from '@apidevtools/swagger-parser'
import { OpenAPIV3 } from 'openapi-types'
import Paw from 'types/paw'
import PawConverter from './converter'
import config from '../paw.config'

const { identifier, title, fileExtensions } = config

export default class OpenAPIv3Importer implements Paw.Importer {
  public static title = title
  public static identifier = identifier
  public static fileExtensions = [...fileExtensions]
  public static inputs = [
    InputField('environmentDomainName', 'Environment Domain Name', 'String', {
      persisted: true,
    }),
    InputField('groupName', 'Group Name', 'String', {
      persisted: true,
    }),
    InputField('shouldReplaceGroup', 'Replace Group', 'Checkbox', {
      persisted: true,
      defaultValue: true,
    }),
    InputField('shouldGroupByTags', 'Group By Tags', 'Checkbox', {
      persisted: true,
      defaultValue: false,
    }),
  ]

  /**
   * @property {Object<SwaggerParser.Options>} parserOptions
   *  - swarggger parser options
   */
  private parserOptions: SwaggerParser.Options = {
    resolve: {
      file: false,
    },
    dereference: {
      circular: true,
    },
  }

  /**
   * @method canImport
   * @see {@link https://paw.cloud/docs/extensions/create-importer}
   * @summary
   *    evaluates items and returns a bool indicating if the extension can import
   *    the items; alternatively, can return the level of confidence as a float
   *    between 0.0 (can't import) and 1.0 (can import for sure).
   *
   * @param context - a context instance
   * @param items - an array of string items
   *
   * @returns {number}
   */
  public canImport(context: Paw.Context, items: Paw.ExtensionItem[]): number {
    return items.reduce((acc, item: Paw.ExtensionItem) => {
      const doc = this.parseContent(item) as OpenAPIV3.Document
      if (!doc) return 0
      return (
        doc.openapi.startsWith('3.0') && // allowed versions 3.0.x.*
        typeof doc.info === 'object' &&
        typeof doc.paths === 'object' &&
        Object.keys(doc.paths).length > 0
      )
    }, true)
      ? 1
      : 0
  }

  /**
   * @method import
   * @summary generates the output code
   * @see {@link https://paw.cloud/docs/extensions/create-importer}
   *
   * @param {Object<Paw.Context>} context - a context instance
   * @param {Array<Paw.ExtensionItem>} items
   *  - an array of items, each is a dictionary with the properties
   *
   * @param {Object<Paw.ExtensionOption>} options - extension options
   * @returns {Boolean}
   */
  public import(
    context: Paw.Context,
    items: Paw.ExtensionItem[],
    options: Paw.ExtensionOption<{
      groupName?: string;
      shouldReplaceGroup?: boolean;
      shouldGroupByTags?: boolean;
      environmentDomainName?: string;
    }>,
  ): Promise<boolean> {
    let rootGroup: Paw.RequestGroup | undefined;
    const groupName = options.inputs?.groupName;
    if (groupName) {
      rootGroup = context.getRootGroups().find(x => x.name === groupName)
      if (rootGroup && options.inputs?.shouldReplaceGroup) {
        rootGroup.deleteGroup()
        rootGroup = undefined
      }
      if (!rootGroup) {
        rootGroup = context.createRequestGroup(groupName)
      }
    }
    
    const documents = [...items].map(
      (item: Paw.ExtensionItem): Promise<OpenAPIV3.Document> => {
        const apiParser = new SwaggerParser()
        const apiDocument = this.parseContent(item)
        const filename =
          item.file?.name.replace(/\.(yml|yaml|json)$/, '') || item.name
        return apiParser
          .validate(apiDocument, this.parserOptions)
          .then(() => {
            const convertDocument = new PawConverter(
              apiParser,
              filename,
              item.url ?? undefined,
              rootGroup,
              options.inputs?.shouldGroupByTags ?? false,
              options.inputs?.environmentDomainName,
              context,
            )
            convertDocument.init()
            return apiParser.api
          })
          .catch((error) => error)
      },
    )

    return Promise.all(documents)
      .then((data) => data.length > 0)
      .catch((error) => {
        throw error
      })
  }

  /**
   * @private
   * @method parseContent
   * @summary
   *  a private method that parses file content from string into an object.
   * @param {Object<Paw.ExtensionItem>} opts
   * @param {String} opts.mimeType
   * @param {String} opts.content
   * @returns {Object<OpenAPIV3.Document>}
   */
  private parseContent({
    mimeType,
    content,
  }: Paw.ExtensionItem): OpenAPIV3.Document {
    try {
      const context =
        mimeType === 'application/json'
          ? JSON.parse(content)
          : Yaml.parse(content)
      return context
    } catch (error) {
      throw new Error(`Failed to parse OpenAPI file: ${error}`)
    }
  }
}
