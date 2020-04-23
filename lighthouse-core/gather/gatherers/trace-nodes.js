/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Gatherer = require('./gatherer.js');
const pageFunctions = require('../../lib/page-functions.js');
const TraceProcessor = require('../../lib/tracehouse/trace-processor.js');

const LH_ATTRIBUTE_MARKER = 'lhtemp';

/**
 * @fileoverview
 * This gatherer find the Largest Contentful Paint element identified in the trace. Since the trace only has the nodeId of the element,
 * we temporarily add an attribute so that we can query the dom and grab all of the element's details.
 */

/**
 * @return {LH.Artifacts['TraceNodes']}
 */
/* istanbul ignore next */
function collectTraceNodes() {
  /** @type {Array<HTMLElement>} */
  // @ts-ignore - put into scope via stringification
  const markedElements = getElementsInDocument('[lhtemp]'); // eslint-disable-line no-undef
  /** @type {LH.Artifacts['TraceNodes']} */
  const traceNodes = [];
  const ATTRIBUTE_REGEX = /\slhtemp="[a-z]{3}"/;
  for (const element of markedElements) {
    // @ts-ignore - put into scope via stringification
    const htmlSnippet = getOuterHTMLSnippet(element); // eslint-disable-line no-undef
    traceNodes.push({
      metricTag: element.getAttribute('lhtemp') || '',
      // @ts-ignore - put into scope via stringification
      nodePath: getNodePath(element), // eslint-disable-line no-undef
      // @ts-ignore - put into scope via stringification
      selector: getNodeSelector(element), // eslint-disable-line no-undef
      // @ts-ignore - put into scope via stringification
      nodeLabel: getNodeLabel(element), // eslint-disable-line no-undef
      snippet: htmlSnippet.replace(ATTRIBUTE_REGEX, ''),
    });
  }
  return traceNodes;
}

class TraceNodes extends Gatherer {
  /**
   * @param {LH.TraceEvent | undefined} lcpEvent
   * @return {number | undefined}
   */
  static getNodeIDFromTraceEvent(lcpEvent) {
    return lcpEvent && lcpEvent.args &&
      lcpEvent.args.data && lcpEvent.args.data.nodeId;
  }

  /**
   * @param {LH.Gatherer.PassContext} passContext
   * @param {LH.Gatherer.LoadData} loadData
   * @return {Promise<LH.Artifacts['TraceNodes']>}
   */
  async afterPass(passContext, loadData) {
    const driver = passContext.driver;
    if (!loadData.trace) {
      throw new Error('Trace is missing!');
    }
    const traceOfTab = TraceProcessor.computeTraceOfTab(loadData.trace);
    const lcpEvent = traceOfTab.largestContentfulPaintEvt;
    /** @type {Array<number>} */
    const backendNodeIds = [];

    const lcpNodeId = TraceNodes.getNodeIDFromTraceEvent(lcpEvent);
    if (lcpNodeId) {
      backendNodeIds.push(lcpNodeId);
    }
    // DOM.getDocument is necessary for pushNodesByBackendIdsToFrontend to properly retrieve nodeIds
    await driver.sendCommand('DOM.getDocument', {depth: -1, pierce: true});
    const translatedIds = await driver.sendCommand('DOM.pushNodesByBackendIdsToFrontend',
      {backendNodeIds: backendNodeIds});

    // A bit hacky.
    await driver.sendCommand('DOM.setAttributeValue', {
      nodeId: translatedIds.nodeIds[0],
      name: LH_ATTRIBUTE_MARKER,
      value: 'lcp',
    });

    const expression = `(() => {
      ${pageFunctions.getElementsInDocumentString};
      ${pageFunctions.getNodePathString};
      ${pageFunctions.getNodeSelectorString};
      ${pageFunctions.getNodeLabelString};
      ${pageFunctions.getOuterHTMLSnippetString};

      return (${collectTraceNodes})();
    })()`;

    const traceNodes = await driver.evaluateAsync(expression, {useIsolation: true});
    await driver.sendCommand('DOM.removeAttribute', {
      nodeId: translatedIds.nodeIds[0],
      name: LH_ATTRIBUTE_MARKER,
    });
    return traceNodes;
  }
}

module.exports = TraceNodes;
