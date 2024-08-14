/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

// <reference path="_references.ts"/>
import { last, uniq } from "lodash";
import powerbi from "powerbi-visuals-api";
import DataView = powerbi.DataView;

import { DotPlotData } from "./visualData";
import { DotPlotBuilder } from "./visualBuilder";

import { assertColorsMatch, ClickEventType } from "powerbi-visuals-utils-testutils";

import { isColorAppliedToElements, getSolidColorStructuralObject } from "./helpers/helpers";

describe("DotPlot", () => {
    let visualBuilder: DotPlotBuilder,
        defaultDataViewBuilder: DotPlotData,
        dataView: DataView;

    beforeEach(() => {
        visualBuilder = new DotPlotBuilder(1000, 500);
        defaultDataViewBuilder = new DotPlotData();
        dataView = defaultDataViewBuilder.getDataView();
    });

    describe("DOM tests", () => {
        it("svg element created", () => {
            expect(visualBuilder.mainElement[0]).toBeInDOM();
        });

        it("update", done => {
            visualBuilder.updateRenderTimeout(dataView, () => {
                const dotplotGroupLength: number = visualBuilder.mainElement
                    .children(".dotplotSelector")
                    .children(".dotplotGroup")
                    .length;

                const tickLength: number = visualBuilder.mainElement
                    .children(".axisGraphicsContext")
                    .children(".x.axis")
                    .children(".tick")
                    .length;

                expect(dotplotGroupLength).toBeGreaterThan(0);
                expect(tickLength).toBe(dataView.categorical!.categories![0].values.length);

                done();
            });
        });

        it("xAxis tick labels have tooltip", done => {
            defaultDataViewBuilder.valuesCategory = DotPlotData.ValuesCategoryLongNames;
            dataView = defaultDataViewBuilder.getDataView();

            visualBuilder.updateRenderTimeout(dataView, () => {
                // visualBuilder.xAxisTicks.each((i, e) => {
                //     if (!$(e).children("text").get(0)
                //     && $(e).children("text").get(0)!.firstChild
                //     && !expect(
                //         $(e).children("text").get(0)!.firstChild!.textContent
                //     ).toEqual(
                //         String(dataView.categorical.categories[0].values[i]) || "(Blank)"
                //     )) {
                //         return false;
                //     }
                // });

                visualBuilder.xAxisTicks.each((i, element) => {
                    const textElement: Element = element.querySelector("text") as Element;

                    expect(textElement).toBeDefined();
                    expect(textElement.textContent).toMatch(`${String(dataView.categorical!.categories![0].values[i])}|(Blank)`);
                });

                done();
            });
        });

        it("should correctly render duplicates in categories", done => {
            dataView.categorical.categories[0].values[1] =
                dataView.categorical.categories[0].values[0];

            dataView.categorical.categories[0].identity[1] =
                dataView.categorical.categories[0].identity[0];

            visualBuilder.updateRenderTimeout(dataView, () => {
                const groupsRects = visualBuilder.dotGroups
                    .toArray()
                    .map((element: HTMLElement) => element.getBoundingClientRect());

                expect(uniq(groupsRects.map(x => x.left)).length).toEqual(groupsRects.length);

                done();
            });
        });

        it("if visual shouldn't be rendered bottom scrollbar shouldn't be visible", () => {
            dataView = defaultDataViewBuilder.getDataView([DotPlotData.ColumnValues]);
            visualBuilder.update(dataView);
            expect(visualBuilder.mainElement[0].getBoundingClientRect().width).toBe(0);
        });

        it("multi-selection test", () => {
            visualBuilder.updateFlushAllD3Transitions(dataView);

            const firstGroup: JQuery = visualBuilder.dotGroups.eq(0),
                secondGroup: JQuery = visualBuilder.dotGroups.eq(1),
                thirdGroup: JQuery = visualBuilder.dotGroups.eq(2);

            firstGroup.get(0)?.dispatchEvent(new MouseEvent("click"));
            secondGroup.get(0)?.dispatchEvent(new MouseEvent("click", { ctrlKey: true}));

            expect(parseFloat(firstGroup.css("fill-opacity"))).toBe(1);
            expect(parseFloat(secondGroup.css("fill-opacity"))).toBe(1);
            expect(parseFloat(thirdGroup.css("fill-opacity"))).toBeLessThan(1);
        });
    });

    describe("Format settings test", () => {
        describe("X-axis", () => {
            beforeEach(() => {
                dataView.metadata.objects = {
                    categoryAxis: {
                        show: true
                    }
                };
            });

            it("show", () => {
                (dataView.metadata.objects as any).categoryAxis.show = true;

                visualBuilder.updateFlushAllD3Transitions(dataView);

                visualBuilder.xAxisTicks
                    .toArray()
                    .map($)
                    .forEach((e: JQuery) => {
                        expect(e.children("line").css("opacity")).not.toBe("0");
                    });

                visualBuilder.xAxisTicks.toArray()
                    .map(e => $($(e).children("text")[0].childNodes[0]))
                    .forEach(e => {
                        expect(e.is("title")).toBeFalsy();
                        expect(e.text()).not.toBeEmpty();
                    });

                (dataView.metadata.objects as any).categoryAxis.show = false;

                visualBuilder.updateFlushAllD3Transitions(dataView);

                visualBuilder.xAxisTicks
                    .toArray()
                    .map($)
                    .forEach((element: JQuery) => {
                        expect(element.children("line").css("opacity")).toBe("0");
                    });

                visualBuilder.xAxisTicks
                    .toArray()
                    .map(e => $($(e).children("text")[0].childNodes[0]))
                    .forEach(e => {
                        expect(e.is("title")).toBeTruthy();
                    });
            });

            it("title", () => {
                (dataView.metadata.objects as any).categoryAxis.showAxisTitle = true;
                visualBuilder.updateFlushAllD3Transitions(dataView);

                expect(visualBuilder.xAxisLabel).toBeInDOM();

                (dataView.metadata.objects as any).categoryAxis.showAxisTitle = false;
                visualBuilder.updateFlushAllD3Transitions(dataView);

                expect(visualBuilder.xAxisLabel).not.toBeInDOM();
            });

            it("label color", () => {
                const color: string = "#112233";

                (dataView.metadata.objects as any).categoryAxis.showAxisTitle = true;
                (dataView.metadata.objects as any).categoryAxis.labelColor = getSolidColorStructuralObject(color);

                visualBuilder.updateFlushAllD3Transitions(dataView);

                visualBuilder.xAxisTicks
                    .toArray()
                    .map($)
                    .forEach((element: JQuery) => {
                        assertColorsMatch(element.children("text").css("fill"), color);
                    });

                assertColorsMatch(visualBuilder.xAxisLabel.css("fill"), color);
            });
        });

        describe("Dots", () => {
            it("specified color should be applied to all of dots", () => {
                const color: string = "#112233";

                dataView.metadata.objects = {
                    dataPoint: {
                        fill: getSolidColorStructuralObject(color)
                    }
                };

                visualBuilder.updateFlushAllD3Transitions(dataView);

                visualBuilder.dots
                    .toArray()
                    .map($)
                    .forEach((element: JQuery) => {
                        assertColorsMatch(element.css("fill"), color);
                    });
            });

            it("specified radius should be applied to all of dots", () => {
                const radius: number = 5;

                dataView.metadata.objects = {
                    dataPoint: {
                        radius,
                    }
                };

                visualBuilder.updateFlushAllD3Transitions(dataView);

                visualBuilder.dots
                    .toArray()
                    .map($)
                    .forEach((element: JQuery) => {
                        const parsedRadius: number = Number.parseInt(element.attr("r"));

                        expect(parsedRadius).toBe(radius);
                    });
            });
        });

        describe("Data labels", () => {
            beforeEach(() => {
                dataView.metadata.objects = {
                    labels: {
                        show: true
                    }
                };
            });

            it("show", () => {
                (dataView.metadata.objects as any).labels.show = true;
                visualBuilder.updateFlushAllD3Transitions(dataView);

                expect(visualBuilder.dataLabels).toBeInDOM();

                (dataView.metadata.objects as any).labels.show = false;
                visualBuilder.updateFlushAllD3Transitions(dataView);

                expect(visualBuilder.dataLabels).not.toBeInDOM();
            });

            it("color", () => {
                let color: string = "#112233";

                (dataView.metadata.objects as any).labels.color = getSolidColorStructuralObject(color);
                visualBuilder.updateFlushAllD3Transitions(dataView);

                visualBuilder.dataLabels
                    .toArray()
                    .map($)
                    .forEach((element: JQuery) => {
                        assertColorsMatch(element.css("fill"), color);
                    });
            });

            it("display units", () => {
                const displayUnits: number = 1000;

                (dataView.metadata.objects as any).labels.labelDisplayUnits = displayUnits;
                visualBuilder.updateFlushAllD3Transitions(dataView);

                visualBuilder.dataLabels
                    .toArray()
                    .map($)
                    .forEach((element: JQuery) => {
                        expect(last(element.text())).toEqual("K");
                    });
            });

            it("precision", () => {
                const precision: number = 7;

                (dataView.metadata.objects as any).labels.labelDisplayUnits = 1;
                (dataView.metadata.objects as any).labels.labelPrecision = precision;

                visualBuilder.updateFlushAllD3Transitions(dataView);

                visualBuilder.dataLabels
                    .toArray()
                    .map($)
                    .forEach((element: JQuery) => {
                        expect(element.text().split(".")[1].length).toEqual(precision);
                    });
            });

            it("font size", () => {
                const fontSize: number = 23,
                    fontSizeInPt: string = "30.6667px";

                (dataView.metadata.objects as any).labels.fontSize = fontSize;

                visualBuilder.updateFlushAllD3Transitions(dataView);

                visualBuilder.dataLabels
                    .toArray()
                    .map($)
                    .forEach((element: JQuery) => {
                        expect(element.css("font-size")).toBe(fontSizeInPt);
                    });
            });
        });
    });

    describe("Capabilities tests", () => {
        it("all items having displayName should have displayNameKey property", () => {
            jasmine.getJSONFixtures().fixturesPath = "base";

            let jsonData = getJSONFixture("capabilities.json");

            let objectsChecker: Function = (obj) => {
                for (let property in obj) {
                    let value: any = obj[property];

                    if (value.displayName) {
                        expect(value.displayNameKey).toBeDefined();
                    }

                    if (typeof value === "object") {
                        objectsChecker(value);
                    }
                }
            };

            objectsChecker(jsonData);
        });
    });

    describe("High contrast mode", () => {
        const backgroundColor: string = "#000000";
        const foregroundColor: string = "ff00ff";

        beforeEach(() => {
            visualBuilder.visualHost.colorPalette.isHighContrast = true;

            visualBuilder.visualHost.colorPalette.background = { value: backgroundColor };
            visualBuilder.visualHost.colorPalette.foreground = { value: foregroundColor };
        });

        it("should not use fill style", (done) => {
            visualBuilder.updateRenderTimeout(dataView, () => {
                const dots: JQuery[] = visualBuilder.dots.toArray().map(i => {
                    const res: JQuery<HTMLElement> = $(i);
                    return res;
                });
                expect(isColorAppliedToElements(dots, null, "fill"));
                done();
            });
        });

        it("should use stroke style", (done) => {
            visualBuilder.updateRenderTimeout(dataView, () => {
                const dots: JQuery<HTMLElement>[] = visualBuilder.dots.toArray().map(i => {
                    const res: JQuery<HTMLElement> = $(i);
                    return res;
                });
                expect(isColorAppliedToElements(dots, foregroundColor, "stroke"));
                done();
            });
        });
    });
});