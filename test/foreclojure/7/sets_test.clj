(deftest sets-test
  (is (= s (set '(:a :a :b :c :c :c :c :d :d))))
  (is (= s (set/union #{:a :b :c} #{:b :c :d}))))