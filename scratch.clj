(require '[babashka.fs :as fs]
         '[clojure.string :as str]
         '[cheshire.core :as json]
         '[clojure.test :refer [is]])

(def practice-exercises
  (map #(subs (str %) 19)
       (fs/list-dir "exercises\\practice")))

(def instructions-all
  (for [slug practice-exercises]
    (let [f (fs/file "exercises\\practice" slug "\\.docs\\instructions.md")]
      (slurp f))))

(def solutions-all
  (for [slug practice-exercises]
    (let [f (fs/file "exercises\\practice" slug "\\.meta\\src\\example.clj")]
      (slurp f))))

(def src-all
  (for [slug practice-exercises]
    (let [filename (str/replace slug "-" "_")
          f (fs/file "exercises\\practice" slug "src" (str filename ".clj"))]
      (slurp f))))

(def exercises
  (map #(subs (str/replace % ".clj" "") 15)
       (fs/list-dir "exercise_tests")))

(def test-all
  (for [e exercises]
    (let [f (fs/file "exercise_tests" (str e ".clj"))]
      (slurp f))))

(comment
  (spit "exercises.json" 
        (json/generate-string
         (zipmap practice-exercises src-all) 
         {:pretty true}))
  (spit "tests.json"
        (json/generate-string
         (zipmap exercises test-all)
         {:pretty true}))
  (spit "instructions.json"
        (json/generate-string
         (zipmap (map #(str/replace % "-" "_") practice-exercises)
                 instructions-all)
         {:pretty true}))
  (spit "solutions.json"
        (json/generate-string
         (zipmap (map #(str/replace % "-" "_") practice-exercises)
                 solutions-all)
         {:pretty true}))
  )
