/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Gatherer = require('./gatherer.js');
const pageFunctions = require('../../lib/page-functions.js');
const TraceProcessor = require('../../lib/tracehouse/trace-processor.js');
const {
  addRectTopAndBottom,
  getRectOverlapArea,
  getRectArea,
} = require('../../lib/rect-helpers.js');

const LH_ATTRIBUTE_MARKER = 'lhtemp';

/**
 * @fileoverview
 * This gatherer find the Largest Contentful Paint element identified in the trace. Since the trace only has the nodeId of the element,
 * we temporarily add an attribute so that we can identify the element in the DOM.
 */

/**
 * @param {string} attributeMarker
 * @return {LH.Artifacts['TraceElements']}
 */
/* istanbul ignore next */
function collectTraceElements(attributeMarker) {
  /** @type {Array<HTMLElement>} */
  // @ts-ignore - put into scope via stringification
  const markedElements = getElementsInDocument('[' + attributeMarker + ']'); // eslint-disable-line no-undef
  /** @type {LH.Artifacts['TraceElements']} */
  const TraceElements = [];
  for (const element of markedElements) {
    const metricName = element.getAttribute(attributeMarker) || '';
    element.removeAttribute(attributeMarker);
    // @ts-ignore - put into scope via stringification
    TraceElements.push({
      metricName,
      // @ts-ignore - put into scope via stringification
      devtoolsNodePath: getNodePath(element), // eslint-disable-line no-undef
      // @ts-ignore - put into scope via stringification
      selector: getNodeSelector(element), // eslint-disable-line no-undef
      // @ts-ignore - put into scope via stringification
      nodeLabel: getNodeLabel(element), // eslint-disable-line no-undef
      // @ts-ignore - put into scope via stringification
      snippet: getOuterHTMLSnippet(element), // eslint-disable-line no-undef
    });
  }
  return TraceElements;
}

class TraceElements extends Gatherer {
  /**
   * @param {LH.TraceEvent | undefined} event
   * @return {number | undefined}
   */
  static getNodeIDFromTraceEvent(event) {
    return event && event.args &&
      event.args.data && event.args.data.nodeId;
  }

  /**
   * @param {Array<number>} rect
   * @return {LH.Artifacts.Rect}
   */
  static traceRectToLHRect(rect) {
    const rectArgs = {
      x: rect[0],
      y: rect[1],
      width: rect[2],
      height: rect[3],
    };
    return addRectTopAndBottom(rectArgs);
  }

  /**
   * @param {Array<LH.TraceEvent>} mainThreadEvents 
   * @return {Array<number>}
   */
  static getCLSNodesFromMainThreadEvents(mainThreadEvents) {
    const clsPerNodeMap = new Map();
    /** @type {Set<number>} */
    const clsNodeIds = new Set();
    const shiftEvents = mainThreadEvents.filter(e => e.name === 'LayoutShift').map(e => e.args && e.args.data);

    shiftEvents.forEach(event => {
      if (!event) {
        return;
      }

      event.impacted_nodes && event.impacted_nodes.forEach(node => {
        if (!node.node_id || !node.old_rect || !node.new_rect) {
          return;
        }

        const oldRect = TraceElements.traceRectToLHRect(node.old_rect);
        const newRect = TraceElements.traceRectToLHRect(node.new_rect);
        const areaOfImpact = getRectArea(oldRect) +
          getRectArea(newRect) - 
          getRectOverlapArea(oldRect, newRect);
        
        let prevShiftTotal = 0;
        if (clsPerNodeMap.has(node.node_id)) {
          prevShiftTotal += clsPerNodeMap.get(node.node_id);
        }
        clsPerNodeMap.set(node.node_id, prevShiftTotal + areaOfImpact);
        clsNodeIds.add(node.node_id);
      });
    });
    
    const topFive = [...clsPerNodeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5).map(entry => Number(entry[0]));
    
    return topFive;
  }

  /**
   * @param {LH.Gatherer.PassContext} passContext
   * @param {LH.Gatherer.LoadData} loadData
   * @return {Promise<LH.Artifacts['TraceElements']>}
   */
  async afterPass(passContext, loadData) {
    const driver = passContext.driver;
    if (!loadData.trace) {
      throw new Error('Trace is missing!');
    }
    const {largestContentfulPaintEvt, mainThreadEvents} = TraceProcessor.computeTraceOfTab(loadData.trace);
    /** @type {Array<number>} */
    const backendNodeIds = [];

    const lcpNodeId = TraceElements.getNodeIDFromTraceEvent(largestContentfulPaintEvt);
    const clsNodeIds = TraceElements.getCLSNodesFromMainThreadEvents(mainThreadEvents);
    if (lcpNodeId) {
      backendNodeIds.push(lcpNodeId);
    }
    backendNodeIds.push(...clsNodeIds);
    // DOM.getDocument is necessary for pushNodesByBackendIdsToFrontend to properly retrieve nodeIds.
    await driver.sendCommand('DOM.getDocument', {depth: -1, pierce: true});
    const translatedIds = await driver.sendCommand('DOM.pushNodesByBackendIdsToFrontend',
      {backendNodeIds: backendNodeIds});

    // Mark the LCP element so we can find it in the page.
    for (let i = 0; i < backendNodeIds.length; i++) {
      const metricName = lcpNodeId === backendNodeIds[i] ? 'largest-contentful-paint' : 'cumulative-layout-shift';
      await driver.sendCommand('DOM.setAttributeValue', {
        nodeId: translatedIds.nodeIds[i],
        name: LH_ATTRIBUTE_MARKER,
        value: metricName,
      });
    }

    const expression = `(() => {
      ${pageFunctions.getElementsInDocumentString};
      ${pageFunctions.getNodePathString};
      ${pageFunctions.getNodeSelectorString};
      ${pageFunctions.getNodeLabelString};
      ${pageFunctions.getOuterHTMLSnippetString};

      return (${collectTraceElements})('${LH_ATTRIBUTE_MARKER}');
    })()`;

    return driver.evaluateAsync(expression, {useIsolation: true});
  }
}

module.exports = TraceElements;
