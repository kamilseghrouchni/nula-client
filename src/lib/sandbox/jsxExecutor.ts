// @ts-ignore - No types available for @babel/standalone
import * as Babel from '@babel/standalone';
import * as React from 'react';
import * as recharts from 'recharts';

const ALLOWED_IMPORTS = ['recharts', 'react'];

export function validateImports(code: string): { valid: boolean; error?: string } {
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  const matches = [...code.matchAll(importRegex)];

  for (const match of matches) {
    const importPath = match[1];
    const isAllowed = ALLOWED_IMPORTS.some(allowed => importPath.startsWith(allowed));

    if (!isAllowed) {
      return {
        valid: false,
        error: `Import not allowed: ${importPath}. Only recharts and react are permitted.`
      };
    }
  }

  return { valid: true };
}

export function executeJSX(code: string, props: any = {}) {
  // Validate imports first
  const validation = validateImports(code);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Remove import statements since we'll provide the modules directly
  let cleanCode = code.replace(/import\s+.*?\s+from\s+['"][^'"]+[''];?\n?/g, '');

  // Replace export default with a variable assignment
  cleanCode = cleanCode.replace(/export\s+default\s+/g, 'const Component = ');

  // Transform JSX to JS
  let transformed: string;
  try {
    transformed = Babel.transform(cleanCode, {
      presets: ['react'],
      filename: 'artifact.jsx',
    }).code!;
  } catch (babelError: any) {
    throw new Error(
      `Babel transformation failed: ${babelError.message}\n\n` +
      `This usually happens with:\n` +
      `- Unicode characters in JSX (use HTML entities instead: ✓ → &check;)\n` +
      `- Invalid JSX syntax\n` +
      `- Missing closing tags\n\n` +
      `Please fix the code and try again.`
    );
  }

  // Wrap the transformed code to return the component
  const wrappedCode = `
    'use strict';
    ${transformed}
    return Component;
  `;

  // Create a scope with available modules
  const exports: any = {};
  const module = { exports };

  // Make React, React hooks, and recharts available as globals in the function scope
  const func = new Function(
    'React',
    'useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext',
    'exports',
    'module',
    // Destructure recharts components into scope
    'BarChart', 'Bar', 'LineChart', 'Line', 'ScatterChart', 'Scatter',
    'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'Legend', 'ResponsiveContainer',
    'PieChart', 'Pie', 'Cell', 'Area', 'AreaChart', 'ComposedChart',
    'RadarChart', 'Radar', 'RadialBarChart', 'RadialBar', 'PolarGrid', 'PolarAngleAxis', 'PolarRadiusAxis',
    'ReferenceLine', 'ReferenceArea', 'ReferenceDot',
    wrappedCode
  );

  // Execute with real modules
  try {
    const result = func(
      React,
      React.useState, React.useEffect, React.useMemo, React.useCallback, React.useRef, React.useContext,
      exports,
      module,
      // Pass recharts components
      recharts.BarChart, recharts.Bar, recharts.LineChart, recharts.Line,
      recharts.ScatterChart, recharts.Scatter,
      recharts.XAxis, recharts.YAxis, recharts.CartesianGrid, recharts.Tooltip,
      recharts.Legend, recharts.ResponsiveContainer,
      recharts.PieChart, recharts.Pie, recharts.Cell, recharts.Area,
      recharts.AreaChart, recharts.ComposedChart,
      recharts.RadarChart, recharts.Radar, recharts.RadialBarChart, recharts.RadialBar,
      recharts.PolarGrid, recharts.PolarAngleAxis, recharts.PolarRadiusAxis,
      recharts.ReferenceLine, recharts.ReferenceArea, recharts.ReferenceDot
    );
    return result;
  } catch (execError: any) {
    // Provide helpful error messages for common issues
    const errorMsg = execError.message || String(execError);

    if (errorMsg.includes('is not defined')) {
      const match = errorMsg.match(/(\w+) is not defined/);
      if (match) {
        const undefinedVar = match[1];
        throw new Error(
          `Component or variable "${undefinedVar}" is not defined.\n\n` +
          `Available Recharts components:\n` +
          `- BarChart, Bar\n` +
          `- LineChart, Line\n` +
          `- ScatterChart, Scatter\n` +
          `- PieChart, Pie\n` +
          `- AreaChart, Area\n` +
          `- ComposedChart\n` +
          `- RadarChart, Radar\n` +
          `- RadialBarChart, RadialBar\n` +
          `- XAxis, YAxis, CartesianGrid, Tooltip, Legend\n` +
          `- ResponsiveContainer, Cell\n` +
          `- ReferenceLine, ReferenceArea, ReferenceDot\n` +
          `- PolarGrid, PolarAngleAxis, PolarRadiusAxis\n\n` +
          `Common mistakes:\n` +
          `- "RechartBar" → should be "Bar"\n` +
          `- "RechartBarChart" → should be "BarChart"\n` +
          `- Missing component from imports`
        );
      }
    }

    throw new Error(`Execution failed: ${errorMsg}`);
  }
}