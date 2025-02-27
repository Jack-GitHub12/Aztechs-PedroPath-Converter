function downloadFile(type) {
    const javaEditor = document.getElementById("javaEditor");
    const jsonEditor = document.getElementById("jsonEditor");
    const fileNameInput = document.getElementById("fileName");
  
    const content = type === "json" ? jsonEditor.value : javaEditor.value;
    let fileName = fileNameInput.value.trim() || "path_config";
    fileName += type === "json" ? ".pp" : ".java";
  
    const blob = new Blob([content], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
  
  function clearAll() {
    document.getElementById("javaEditor").value = "";
    document.getElementById("jsonEditor").value = "";
    document.getElementById("fileName").value = "";
  }
  
  function clearEditor(type) {
    document.getElementById(type === "java" ? "javaEditor" : "jsonEditor").value =
      "";
  }
  
  // Quick copy function for each editor
  function copyEditor(type) {
    const editor = document.getElementById(
      type === "java" ? "javaEditor" : "jsonEditor"
    );
    navigator.clipboard
      .writeText(editor.value)
      .then(() => {
        alert("Copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  }
  
  // Quick paste function for each editor
  function pasteEditor(type) {
    navigator.clipboard
      .readText()
      .then((text) => {
        const editor = document.getElementById(
          type === "java" ? "javaEditor" : "jsonEditor"
        );
        editor.value = text;
        // Trigger input event to update conversion if needed
        editor.dispatchEvent(new Event("input"));
      })
      .catch((err) => {
        console.error("Failed to read clipboard contents: ", err);
      });
  }
  
  // Load file content into JSON editor from an uploaded file
  function loadJSONFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const content = e.target.result;
      document.getElementById("jsonEditor").value = content;
      // Trigger conversion from JSON to Java if needed
      document.getElementById("jsonEditor").dispatchEvent(new Event("input"));
    };
    reader.readAsText(file);
    // Clear the file input so the same file can be uploaded again if needed
    event.target.value = "";
  }
  
  // Generate random hex color different from previous
  function generateRandomColor(previousColor) {
    const letters = "0123456789ABCDEF";
    let color;
    do {
      color = "#";
      for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
    } while (color === previousColor); // Ensure unique consecutive colors
    return color;
  }
  
  document.addEventListener("DOMContentLoaded", () => {
    const javaEditor = document.getElementById("javaEditor");
    const jsonEditor = document.getElementById("jsonEditor");
    let updating = false;
  
    javaEditor.addEventListener("input", () => {
      if (updating) return;
      try {
        const jsonData = javaToJson(javaEditor.value);
        updating = true;
        jsonEditor.value = JSON.stringify(jsonData, null, 4);
        updating = false;
      } catch (error) {
        console.error("Conversion error:", error);
      }
    });
  
    jsonEditor.addEventListener("input", () => {
      if (updating) return;
      try {
        const jsonData = JSON.parse(jsonEditor.value);
        updating = true;
        javaEditor.value = jsonToJava(jsonData);
        updating = false;
      } catch (error) {
        console.error("Conversion error:", error);
      }
    });
  
    function javaToJson(javaCode) {
      const startPoseMatch = javaCode.match(
        /setStartingPose\(new Pose\(([^,]+),\s*([^,]+),\s*Math\.toRadians\(([^)]+)\)\)\);/
      );
      const lines = [];
      let currentHeading = startPoseMatch ? parseFloat(startPoseMatch[3]) : 0;
      let previousColor = null;
  
      const lineRegex = /follower\.pathBuilder\(\)[^;]+?;/gs;
      const matches = javaCode.matchAll(lineRegex);
  
      for (const match of matches) {
        const lineContent = match[0];
        const points = [];
        const pointRegex = /new Point\(([^,]+),\s*([^,]+)/g;
        let pointMatch;
  
        while ((pointMatch = pointRegex.exec(lineContent)) !== null) {
          points.push({
            x: parseFloat(pointMatch[1]),
            y: parseFloat(pointMatch[2]),
          });
        }
  
        const headingMatch = lineContent.match(
          /setLinearHeadingInterpolation\(Math\.toRadians\(([^)]+)\),\s*Math\.toRadians\(([^)]+)\)\)/
        );
        const endDeg = headingMatch ? parseFloat(headingMatch[2]) : currentHeading;
  
        // Generate unique color for each line
        const lineColor = generateRandomColor(previousColor);
        previousColor = lineColor;
  
        lines.push({
          endPoint: {
            x: points[points.length - 1].x,
            y: points[points.length - 1].y,
            heading: "linear",
            reverse: false,
            startDeg: currentHeading,
            endDeg: endDeg,
          },
          controlPoints: points.slice(1, -1).map((p) => ({ x: p.x, y: p.y })),
          color: lineColor,
        });
  
        currentHeading = endDeg;
      }
  
      return {
        startPoint: {
          x: startPoseMatch ? parseFloat(startPoseMatch[1]) : 0,
          y: startPoseMatch ? parseFloat(startPoseMatch[2]) : 0,
          heading: "constant",
          degrees: startPoseMatch ? parseFloat(startPoseMatch[3]) : 0,
        },
        lines: lines,
      };
    }
  
    function jsonToJava(jsonData) {
      let javaCode = "// Auto-generated path configuration\n\n";
      javaCode += `follower.setStartingPose(new Pose(${jsonData.startPoint.x}, ${jsonData.startPoint.y}, Math.toRadians(${jsonData.startPoint.degrees})));\n\n`;
  
      let currentX = jsonData.startPoint.x;
      let currentY = jsonData.startPoint.y;
      let currentHeading = jsonData.startPoint.degrees;
  
      jsonData.lines.forEach((line, index) => {
        const points = [{ x: currentX, y: currentY }, ...line.controlPoints, line.endPoint];
        const pointStrings = points
          .map(
            (p) =>
              `new Point(${p.x.toFixed(3)}, ${p.y.toFixed(3)}, Point.CARTESIAN)`
          )
          .join(",\n                        ");
  
        javaCode += `Path${index + 1} = follower.pathBuilder()\n`;
        javaCode += `    .addPath(new BezierLine(\n`;
        javaCode += `        ${pointStrings}\n`;
        javaCode += `    ))\n`;
        javaCode += `    .setLinearHeadingInterpolation(Math.toRadians(${line.endPoint.startDeg}), Math.toRadians(${line.endPoint.endDeg}))\n`;
        javaCode += `    .setPathEndTimeoutConstraint(0)\n`;
        javaCode += `    .build();\n\n`;
  
        currentX = line.endPoint.x;
        currentY = line.endPoint.y;
        currentHeading = line.endPoint.endDeg;
      });
  
      return javaCode;
    }
  });
  