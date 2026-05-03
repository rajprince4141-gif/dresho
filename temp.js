const fs = require('fs');
const html = fs.readFileSync('../dresho.html', 'utf8');

const bodyMatch = html.match(/<body>([\s\S]*?)<script>/i);
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/i);

if (bodyMatch && scriptMatch) {
  let bodyContent = bodyMatch[1].replace(/<div id="cur"><\/div>\s*<div id="cur-ring"><\/div>/, '');
  bodyContent = bodyContent.replace(/`/g, '\\`'); // escape backticks

  const scriptContent = scriptMatch[1];

  const component = `
"use client";
import React, { useEffect } from 'react';

export default function DesignDemo() {
  useEffect(() => {
    ${scriptContent}
  }, []);

  return (
    <>
      <div id="cur"></div>
      <div id="cur-ring"></div>
      <div dangerouslySetInnerHTML={{ __html: \`${bodyContent}\` }} />
    </>
  );
}
`;

  fs.writeFileSync('src/app/design-demo/page.js', component);
  console.log('Successfully created design-demo/page.js');
} else {
  console.log('Could not extract body or script from dresho.html');
}
