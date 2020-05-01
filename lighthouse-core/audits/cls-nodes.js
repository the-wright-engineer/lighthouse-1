/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const Audit = require('./audit.js');
const i18n = require('../lib/i18n/i18n.js');

const UIStrings = {
  title: 'Top Culumlative Layout Shift Elements',
  description: 'These are the elements that contribute most to the CLS of the site.',
  displayValue: `{nodeCount, plural,
    =0 {No elements found}
    =1 {1 element found}
    other {# elements found}
    }`,
  columnHeader: 'Element',
};

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);

class CLSNodes extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'cls-nodes',
      title: str_(UIStrings.title),
      description: str_(UIStrings.description),
      scoreDisplayMode: Audit.SCORING_MODES.INFORMATIVE,
      requiredArtifacts: ['TraceElements'],
    };
  }

  /**
   * @param {LH.Artifacts.TraceElement[]} traceNodes
   * @return {LH.Audit.Details.Table['items']}
   */
  static getCLSNodeData(traceNodes) {
    const clsNodes = traceNodes.filter(node => node.metricName === 'cumulative-layout-shift');
    return clsNodes.map(node => {
      return {
        node: /** @type {LH.Audit.Details.NodeValue} */ ({
          type: 'node',
          path: node.devtoolsNodePath,
          selector: node.selector,
          nodeLabel: node.nodeLabel,
          snippet: node.snippet,
        }),
      }
    });
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @return {LH.Audit.Product}
   */
  static audit(artifacts) {
    const clsNodeData = this.getCLSNodeData(artifacts.TraceElements);

    /** @type {LH.Audit.Details.Table['headings']} */
    const headings = [
      {key: 'node', itemType: 'node', text: str_(UIStrings.columnHeader)},
    ];

    const details = Audit.makeTableDetails(headings, clsNodeData);
    const displayValue = str_(UIStrings.displayValue, {nodeCount: clsNodeData.length});

    return {
      score: 1,
      displayValue,
      details,
    };
  }
}

module.exports = CLSNodes;
module.exports.UIStrings = UIStrings;
