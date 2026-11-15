// Exact-byte reconstitution of frozen 2026-11-15 first public requests and separate controls.
// Every replay asserts sha256(JSON.stringify(value,null,2)+'\n') against the original frozen input SHA.
// T4 is exposed historical B06, never unfamiliar transfer. No Solutions images.
export const REQUESTS = {
  "T1": {
    "sha256": "84109a6a8ae06d807340b5b49955a481abe1d2cea008df04e6c3bde74a35359f",
    "value": {
      "format": "opticsim-problem-v1",
      "physical": {
        "lengthUnit": "cm",
        "title": "T1 source-stated two parallel mirrors; finite mirror geometry deliberately missing",
        "components": [
          {
            "id": "S1",
            "type": "point-source",
            "parameters": {
              "x": 10,
              "y": 0
            }
          },
          {
            "id": "M1",
            "type": "plane-mirror",
            "parameters": {
              "x": 0,
              "y": 0,
              "orientationDeg": 90
            }
          },
          {
            "id": "M2",
            "type": "plane-mirror",
            "parameters": {
              "x": 40,
              "y": 0,
              "orientationDeg": 90
            }
          }
        ]
      },
      "requests": [
        {
          "id": "nearest_five",
          "kind": "five-nearest-parallel-plane-mirror-images"
        }
      ],
      "illustration": false
    }
  },
  "T2": {
    "sha256": "f8d0c1d433f8377c5faf6f9fd7c13e625fa6312b60305045f153c37546caf9e8",
    "value": {
      "format": "opticsim-problem-v1",
      "physical": null,
      "requests": [
        {
          "id": "coincidence",
          "kind": "plate-front-reflection-convex-mirror-image-coincidence"
        },
        {
          "id": "observation",
          "kind": "direct-observation-image-coincidence"
        }
      ]
    }
  },
  "T3": {
    "sha256": "3b1ea46265984a391d8094edf2313f0b389d501094590aab2dbf8652e42b05f3",
    "value": {
      "format": "opticsim-problem-v1",
      "physical": {
        "format": "opticsim-planar-angular-facts-v1",
        "source": {
          "id": "SunRay",
          "region": 0,
          "incidentAngleDeg": 45,
          "approach": "positive"
        },
        "interfaces": [
          {
            "id": "AirWater",
            "negativeIndex": 1,
            "positiveIndex": 1.3333333333333333
          }
        ]
      },
      "requests": [
        {
          "id": "water_angle",
          "kind": "branch-angles",
          "sourceId": "SunRay",
          "branches": [
            {
              "id": "through_water_surface",
              "events": [
                {
                  "interfaceId": "AirWater",
                  "action": "transmit"
                }
              ]
            }
          ]
        },
        {
          "id": "shadow_length",
          "kind": "lake-bottom-pole-shadow-length"
        }
      ]
    }
  },
  "T4": {
    "sha256": "6733d465552fe2fc55a6344a14c2fd996e023a1aee4f994f214b60791fda82d4",
    "value": {
      "format": "opticsim-problem-v1",
      "physical": {
        "format": "opticsim-planar-angular-facts-v1",
        "source": {
          "id": "S1",
          "region": 1,
          "incidentAngleDeg": 30,
          "approach": "positive"
        },
        "interfaces": [
          {
            "id": "AirToN1",
            "negativeIndex": 1,
            "positiveIndex": 1.3
          },
          {
            "id": "N1ToN2",
            "negativeIndex": 1.3,
            "positiveIndex": 1.4
          },
          {
            "id": "N2ToN3",
            "negativeIndex": 1.4,
            "positiveIndex": 1.32
          },
          {
            "id": "N3ToN4",
            "negativeIndex": 1.32,
            "positiveIndex": 1.45
          }
        ]
      },
      "requests": [
        {
          "id": "theta4_theta5",
          "kind": "branch-angles",
          "sourceId": "S1",
          "branches": [
            {
              "id": "theta5_reflection_then_air",
              "events": [
                {
                  "interfaceId": "N1ToN2",
                  "action": "reflect"
                },
                {
                  "interfaceId": "AirToN1",
                  "action": "transmit"
                }
              ]
            },
            {
              "id": "theta4_three_transmissions",
              "events": [
                {
                  "interfaceId": "N1ToN2",
                  "action": "transmit"
                },
                {
                  "interfaceId": "N2ToN3",
                  "action": "transmit"
                },
                {
                  "interfaceId": "N3ToN4",
                  "action": "transmit"
                }
              ]
            }
          ]
        }
      ]
    }
  },
  "T5": {
    "sha256": "cc4f22bb33568e441873b0aa77e4b6b16588498b3999aeb586a8df9ea434c995",
    "value": {
      "format": "opticsim-problem-v1",
      "physical": null,
      "requests": [
        {
          "id": "prism_n",
          "kind": "silvered-prism-retroreflection-index"
        }
      ]
    }
  },
  "T6": {
    "sha256": "f3b6bfc10b5335880b0e26cf345be85fc529c1ea3c4c288624ac3aab55db1d82",
    "value": {
      "format": "opticsim-problem-v1",
      "physical": null,
      "requests": [
        {
          "id": "slab_n",
          "kind": "slab-plus-ideal-lens-shortest-object-image-index"
        },
        {
          "id": "image_shift",
          "kind": "contact-concave-lens-image-shift-through-slab"
        }
      ]
    }
  },
  "C1R2": {
    "sha256": "d65d283179cc838aaf4edea60a8db62e9591d7fc5c8d0ce83ad728e49e842f56",
    "value": {
      "format": "opticsim-problem-v1",
      "physical": {
        "lengthUnit": "mm",
        "title": "Hypothetical T1: finite parallel mirrors with 2 degree ray fan",
        "runPolicy": "preview-v1",
        "components": [
          {
            "id": "S1",
            "type": "point-source",
            "parameters": {
              "x": 100,
              "y": 0,
              "brightness": 0.08
            },
            "emission": {
              "mode": "directional",
              "directionDeg": 10,
              "angleDeg": 2
            }
          },
          {
            "id": "M1",
            "type": "plane-mirror",
            "parameters": {
              "x": 0,
              "y": 0,
              "orientationDeg": 90,
              "length": 600
            }
          },
          {
            "id": "M2",
            "type": "plane-mirror",
            "parameters": {
              "x": 400,
              "y": 0,
              "orientationDeg": 90,
              "length": 600
            }
          }
        ]
      },
      "requests": [
        {
          "id": "emitted",
          "kind": "source-emissions",
          "componentId": "S1"
        },
        {
          "id": "mirror1",
          "kind": "mirror-reflections",
          "componentId": "M1"
        },
        {
          "id": "mirror2",
          "kind": "mirror-reflections",
          "componentId": "M2"
        }
      ],
      "interpretation": {
        "requestedResult": "Illustrate native finite plane-mirror bounces while preserving the given 400 mm separation and object offset 100 mm",
        "stated": [
          "Two mirrors parallel, separation 400 mm, source 100 mm from first plane."
        ],
        "derived": [],
        "assumptions": [
          "Explicitly hypothetical 600 mm mirror lengths and 10 degree single-ray direction, not stated by the source problem.",
          "Arbitrary transverse origin and source brightness 0.08 in native relative units.",
          "Native finite-ray reflection counts are not five virtual image distances.",
          "After first-attempt refusal: v4 general-component-tracing admits a directional fan, not single-ray; this is a teaching intervention with a stated 2-degree cone, not an original image."
        ],
        "unknowns": [
          "The source question does not specify finite mirror extents, ray direction or sampling."
        ]
      },
      "illustration": false
    }
  },
  "C2R": {
    "sha256": "28791a4d00de22d563ab00e673cda504fda1cd568857423f08b2e5f6febfc82b",
    "value": {
      "format": "opticsim-problem-v1",
      "physical": {
        "lengthUnit": "mm",
        "title": "TEACHING ANALOGUE T3: one sunlight ray refracting in a lake, no shadow claim",
        "runPolicy": "preview-v1",
        "components": [
          {
            "id": "SunRay",
            "type": "point-source",
            "parameters": {
              "x": -100,
              "y": 100,
              "brightness": 0.08
            },
            "emission": {
              "mode": "single-ray",
              "directionDeg": -45
            }
          },
          {
            "id": "AirWater",
            "type": "planar-interface",
            "parameters": {
              "x": 0,
              "y": 0,
              "normalDeg": 90,
              "negativeIndex": 1.3333333333333333,
              "positiveIndex": 1,
              "partialReflection": false
            }
          },
          {
            "id": "LakeBottomDetector",
            "type": "ray-detector",
            "parameters": {
              "x": 50,
              "y": -100,
              "orientationDeg": 0,
              "length": 400
            }
          }
        ]
      },
      "requests": [
        {
          "id": "native_angle",
          "kind": "interface-transmission-angle",
          "componentId": "AirWater"
        },
        {
          "id": "native_first",
          "kind": "interface-first-event",
          "componentId": "AirWater"
        },
        {
          "id": "bottom_crossings",
          "kind": "detector-crossings",
          "componentId": "LakeBottomDetector"
        }
      ],
      "interpretation": {
        "requestedResult": "One native air-to-water refracted ray and one passive detector; NOT a shadow length",
        "stated": [
          "Air-to-water interface with water refractive index 4/3, sunlight 45 degrees to horizontal."
        ],
        "derived": [],
        "assumptions": [
          "Synthetic 2D source at (-100,100) mm and a detector 100 mm below water surface are illustrative, not source-given geometry.",
          "Air index 1, transmitted-only native policy and brightness 0.08 are declared teaching approximations.",
          "The actual source has a 3 m submerged pole and asks for continuous shadow; this one ray omits it."
        ],
        "unknowns": [
          "No complete pole blocker or parallel continuous illumination is present; lake-bottom shadow is not calculated."
        ]
      },
      "illustration": false
    }
  }
};
