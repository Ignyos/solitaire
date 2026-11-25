/** @module Game rules dialog content */

/**
 * @param {{ introduction: string, sections: Array<{ heading: string, paragraphs: string[] }> }} rules
 * @returns {HTMLElement}
 */
export function createRulesContent(rules) {
  const content = document.createElement('div');
  content.className = 'rules-content';
  const introduction = document.createElement('p');
  introduction.textContent = rules.introduction;
  content.append(introduction);

  for (const section of rules.sections) {
    const sectionElement = document.createElement('section');
    const heading = document.createElement('h3');
    heading.textContent = section.heading;
    sectionElement.append(heading);
    for (const paragraph of section.paragraphs) {
      const text = document.createElement('p');
      text.textContent = paragraph;
      sectionElement.append(text);
    }
    content.append(sectionElement);
  }
  return content;
}
