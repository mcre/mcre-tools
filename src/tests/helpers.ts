import { BaseWrapper, DOMWrapper, VueWrapper } from "@vue/test-utils";
import { expect } from "vitest";

export const findComponent = (
  wrapper: BaseWrapper<any>,
  selector: string,
): VueWrapper<any> => {
  const element = wrapper.findComponent({ name: selector });
  expect(element.exists()).toBe(true);
  return element;
};

export const find = (
  wrapper: BaseWrapper<any>,
  selector: string,
): DOMWrapper<Element> => {
  const element = wrapper.find(selector);
  expect(element.exists()).toBe(true);
  return element;
};

export const expectIconToBe = (
  vIcon: BaseWrapper<any>,
  expectedIcon: string,
) => {
  expect(vIcon.html()).toContain(expectedIcon);
};
