/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const CLSNodesAudit = require('../../audits/cls-nodes.js');

/* eslint-env jest */

describe('Performance: cls-nodes audit', () => {
  it('correctly surfaces a single CLS node', async () => {
    const artifacts = {
      TraceNodes: [{
        metricTag: 'cls',
        nodePath: '1,HTML,3,BODY,5,DIV,0,HEADER',
        selector: 'div.l-header > div.chorus-emc__content',
        nodeLabel: 'My Test Label',
        snippet: '<h1 class="test-class">',
      }],
    };

    const auditResult = await CLSNodesAudit.audit(artifacts);
    expect(auditResult.score).toEqual(1);
    expect(auditResult.displayValue).toBeDisplayString('1 element found');
    expect(auditResult.details.items).toHaveLength(1);
  });

  it('correctly surfaces multiple CLS nodes', async () => {
    const clsNode = {
      metricTag: 'cls',
      nodePath: '1,HTML,3,BODY,5,DIV,0,HEADER',
      selector: 'div.l-header > div.chorus-emc__content',
      nodeLabel: 'My Test Label',
      snippet: '<h1 class="test-class">',
    };
    const artifacts = {
      TraceNodes: Array(4).fill(clsNode),
    };

    const auditResult = await CLSNodesAudit.audit(artifacts);
    expect(auditResult.score).toEqual(1);
    expect(auditResult.displayValue).toBeDisplayString('4 elements found');
    expect(auditResult.details.items).toHaveLength(4);
  });

  it('correctly handles when there are no CLS nodes', async () => {
    const artifacts = {
      TraceNodes: [],
    };

    const auditResult = await CLSNodesAudit.audit(artifacts);
    expect(auditResult.score).toEqual(1);
    expect(auditResult.displayValue).toBeDisplayString('No elements found');
    expect(auditResult.details.items).toHaveLength(0);
  })
});
